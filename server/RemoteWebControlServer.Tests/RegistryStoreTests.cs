using RemoteWebControl.Models;
using RemoteWebControl.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace RemoteWebControl.Tests;

public class RegistryStoreTests
{
    private static RegistryElement El(string id, string kind = "button") =>
        new(id, kind, $"L-{id}", null, null, null, null, null);

    [Fact]
    public void Put_ThenGet_RoundTrips()
    {
        var r = new RegistryStore(new FakeClock());
        var els = new[] { El("a"), El("b") };
        r.Put("sid", 1, els);
        var got = r.Get("sid");
        Assert.NotNull(got);
        Assert.Equal(1, got!.Version);
        Assert.Equal(2, got.Elements.Length);
    }

    [Fact]
    public void Put_OverwritesPreviousVersion()
    {
        var r = new RegistryStore(new FakeClock());
        r.Put("sid", 1, new[] { El("a") });
        r.Put("sid", 2, new[] { El("a"), El("b") });
        var got = r.Get("sid")!;
        Assert.Equal(2, got.Version);
        Assert.Equal(2, got.Elements.Length);
    }

    [Fact]
    public void Get_UnknownSession_ReturnsNull()
    {
        var r = new RegistryStore(new FakeClock());
        Assert.Null(r.Get("nope"));
    }

    [Fact]
    public void Drop_RemovesEntry()
    {
        var r = new RegistryStore(new FakeClock());
        r.Put("sid", 1, new[] { El("a") });
        r.Drop("sid");
        Assert.Null(r.Get("sid"));
    }

    [Fact]
    public void SessionEviction_AutomaticallyClearsRegistry()
    {
        var clock = new FakeClock();
        var registry = new RegistryStore(clock);
        using var sessions = new SessionStore(NullLogger<SessionStore>.Instance,
            new SessionConfig(TtlMinutes: 30, MaxSessions: 1), clock);
        sessions.SessionEvicted += registry.Drop;

        var a = sessions.CreateSession();
        registry.Put(a, 1, new[] { El("a") });

        clock.AdvanceMs(10);
        var b = sessions.CreateSession();

        Assert.Null(registry.Get(a));
        Assert.False(sessions.SessionExists(a));
        Assert.True(sessions.SessionExists(b));
    }
}
