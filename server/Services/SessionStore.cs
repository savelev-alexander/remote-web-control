using System.Collections.Concurrent;
using RemoteWebControl.Models;

namespace RemoteWebControl.Services;

public sealed class SessionStore : IDisposable
{
    private sealed class Session
    {
        public readonly ConcurrentQueue<string> Queue = new();
        public long LastActivityMs;
    }

    private readonly ConcurrentDictionary<string, Session> _sessions = new();
    private readonly ILogger<SessionStore> _log;
    private readonly IClock _clock;
    private readonly TimeSpan _ttl;
    private readonly int _maxSessions;
    private readonly Timer _cleanupTimer;

    public event Action<string>? SessionEvicted;

    public SessionStore(ILogger<SessionStore> log, SessionConfig config, IClock clock)
    {
        _log         = log;
        _clock       = clock;
        _ttl         = TimeSpan.FromMinutes(Math.Max(1, config.TtlMinutes));
        _maxSessions = Math.Max(1, config.MaxSessions);

        var interval = TimeSpan.FromMinutes(Math.Clamp(_ttl.TotalMinutes / 4.0, 1, 5));
        _cleanupTimer = new Timer(_ => Cleanup(), null, interval, interval);
    }

    public string CreateSession()
    {
        EvictIfFull();
        var id = Guid.NewGuid().ToString("N");
        _sessions[id] = new Session { LastActivityMs = _clock.TickCount64Ms };
        return id;
    }

    public bool SessionExists(string? sessionId) =>
        !string.IsNullOrEmpty(sessionId) && _sessions.ContainsKey(sessionId);

    public void AddCommands(string? sessionId, string[] steps)
    {
        var s = TryTouch(sessionId);
        if (s is null) return;
        foreach (var step in steps) s.Queue.Enqueue(step);
    }

    public string[] FetchCommands(string? sessionId)
    {
        var s = TryTouch(sessionId);
        if (s is null || s.Queue.IsEmpty) return [];

        var result = new List<string>();
        while (s.Queue.TryDequeue(out var cmd)) result.Add(cmd);
        return result.ToArray();
    }

    public int ActiveCount => _sessions.Count;

    internal void RunCleanupForTests() => Cleanup();

    private Session? TryTouch(string? sessionId)
    {
        if (string.IsNullOrEmpty(sessionId) || !_sessions.TryGetValue(sessionId, out var s)) return null;
        s.LastActivityMs = _clock.TickCount64Ms;
        return s;
    }

    private void EvictIfFull()
    {
        if (_sessions.Count < _maxSessions) return;

        var toEvict = _sessions.Count - _maxSessions + 1;
        var oldest = _sessions
            .OrderBy(kvp => kvp.Value.LastActivityMs)
            .Take(toEvict)
            .Select(kvp => kvp.Key)
            .ToArray();
        var evicted = 0;
        foreach (var k in oldest)
        {
            if (_sessions.TryRemove(k, out _))
            {
                SessionEvicted?.Invoke(k);
                evicted++;
            }
        }
        if (evicted > 0)
            _log.LogWarning("Достигнут лимит сессий ({Max}); удалено {Count} самых старых", _maxSessions, evicted);
    }

    private void Cleanup()
    {
        try
        {
            var ttlMs  = (long)_ttl.TotalMilliseconds;
            var cutoff = _clock.TickCount64Ms - ttlMs;
            var expired = 0;

            foreach (var kvp in _sessions)
            {
                if (kvp.Value.LastActivityMs >= cutoff) continue;
                if (_sessions.TryRemove(kvp.Key, out _))
                {
                    SessionEvicted?.Invoke(kvp.Key);
                    expired++;
                }
            }

            if (expired > 0)
                _log.LogInformation("Удалено {Count} неактивных сессий (TTL={Ttl}мин, активных={Active})",
                    expired, _ttl.TotalMinutes, _sessions.Count);
        }
        catch (Exception ex)
        {
            _log.LogWarning("Очистка сессий упала: {Msg}", ex.Message);
        }
    }

    public void Dispose() => _cleanupTimer.Dispose();
}
