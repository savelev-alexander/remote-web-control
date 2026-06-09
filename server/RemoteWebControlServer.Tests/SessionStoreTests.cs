using RemoteWebControl.Models;
using RemoteWebControl.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace RemoteWebControl.Tests;

public class SessionStoreTests
{
    private static SessionStore Make(int ttlMin = 30, int max = 500, FakeClock? clock = null) =>
        new(NullLogger<SessionStore>.Instance, new SessionConfig(ttlMin, max), clock ?? new FakeClock());

    [Fact]
    public void CreateSession_ReturnsUniqueId()
    {
        using var s = Make();
        var ids = Enumerable.Range(0, 50).Select(_ => s.CreateSession()).ToHashSet();
        Assert.Equal(50, ids.Count);
    }

    [Fact]
    public void SessionExists_FalseForUnknown()
    {
        using var s = Make();
        Assert.False(s.SessionExists("nope"));
        Assert.False(s.SessionExists(null));
        Assert.False(s.SessionExists(""));
    }

    [Fact]
    public void AddCommands_ThenFetch_FifoOrder()
    {
        using var s = Make();
        var sid = s.CreateSession();
        s.AddCommands(sid, new[] { "CLICK:a", "CLICK:b", "CLICK:c" });
        Assert.Equal(new[] { "CLICK:a", "CLICK:b", "CLICK:c" }, s.FetchCommands(sid));
    }

    [Fact]
    public void FetchCommands_DrainsQueue()
    {
        using var s = Make();
        var sid = s.CreateSession();
        s.AddCommands(sid, new[] { "CLICK:a" });
        Assert.Single(s.FetchCommands(sid));
        Assert.Empty(s.FetchCommands(sid));
    }

    [Fact]
    public void AddCommands_ToUnknownSession_IsNoop()
    {
        using var s = Make();
        s.AddCommands("ghost", new[] { "CLICK:a" });
        Assert.Empty(s.FetchCommands("ghost"));
    }

    [Fact]
    public void LruEviction_RemovesOldestSession()
    {
        var clock = new FakeClock();
        using var s = Make(max: 3, clock: clock);
        var a = s.CreateSession();
        clock.AdvanceMs(10); var b = s.CreateSession();
        clock.AdvanceMs(10); var c = s.CreateSession();
        clock.AdvanceMs(10); var d = s.CreateSession();

        Assert.False(s.SessionExists(a));
        Assert.True(s.SessionExists(b));
        Assert.True(s.SessionExists(c));
        Assert.True(s.SessionExists(d));
    }

    [Fact]
    public void Cleanup_RemovesExpiredSessions()
    {
        var clock = new FakeClock();
        using var s = Make(ttlMin: 1, clock: clock);
        var stale = s.CreateSession();
        clock.AdvanceMs(70_000);
        var fresh = s.CreateSession();

        s.RunCleanupForTests();

        Assert.False(s.SessionExists(stale));
        Assert.True(s.SessionExists(fresh));
    }

    [Fact]
    public void Cleanup_DoesNotRemoveActiveSession()
    {
        var clock = new FakeClock();
        using var s = Make(ttlMin: 1, clock: clock);
        var sid = s.CreateSession();
        clock.AdvanceMs(70_000);
        s.AddCommands(sid, new[] { "CLICK:keep" });

        s.RunCleanupForTests();

        Assert.True(s.SessionExists(sid));
    }

    [Fact]
    public void SessionEvicted_FiresOnLruRemoval()
    {
        var evicted = new List<string>();
        var clock = new FakeClock();
        using var s = Make(max: 2, clock: clock);
        s.SessionEvicted += sid => evicted.Add(sid);

        var a = s.CreateSession();
        clock.AdvanceMs(10); var b = s.CreateSession();
        clock.AdvanceMs(10); var c = s.CreateSession();

        Assert.Single(evicted);
        Assert.Equal(a, evicted[0]);
    }

    [Fact]
    public void SessionEvicted_FiresOnTtlCleanup()
    {
        var evicted = new List<string>();
        var clock = new FakeClock();
        using var s = Make(ttlMin: 1, clock: clock);
        s.SessionEvicted += sid => evicted.Add(sid);

        var sid = s.CreateSession();
        clock.AdvanceMs(70_000);
        s.RunCleanupForTests();

        Assert.Single(evicted);
        Assert.Equal(sid, evicted[0]);
    }

    [Fact]
    public async Task Concurrent_AddAndFetch_NoDataLoss()
    {
        using var s = Make();
        var sid = s.CreateSession();
        const int producers = 4, perProducer = 250;

        var producerTasks = Enumerable.Range(0, producers).Select(p => Task.Run(() =>
        {
            for (var i = 0; i < perProducer; i++) s.AddCommands(sid, new[] { $"CLICK:p{p}.{i}" });
        })).ToArray();

        await Task.WhenAll(producerTasks);

        var collected = new List<string>();
        while (true)
        {
            var batch = s.FetchCommands(sid);
            if (batch.Length == 0) break;
            collected.AddRange(batch);
        }
        Assert.Equal(producers * perProducer, collected.Count);
    }
}
