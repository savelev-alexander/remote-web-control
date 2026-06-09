using System.Collections.Concurrent;
using RemoteWebControl.Models;

namespace RemoteWebControl.Services;

public sealed class RegistryStore
{
    private readonly ConcurrentDictionary<string, RegistrySnapshot> _byId = new();
    private readonly IClock _clock;

    public RegistryStore(IClock clock) { _clock = clock; }

    public void Put(string sessionId, long version, RegistryElement[] elements) =>
        _byId[sessionId] = new RegistrySnapshot(sessionId, version, _clock.TickCount64Ms, elements);

    public RegistrySnapshot? Get(string sessionId) =>
        _byId.TryGetValue(sessionId, out var snap) ? snap : null;

    public void Drop(string sessionId) => _byId.TryRemove(sessionId, out _);

    public int Count => _byId.Count;
}

public sealed record RegistrySnapshot(string SessionId, long Version, long UpdatedAtMs, RegistryElement[] Elements);
