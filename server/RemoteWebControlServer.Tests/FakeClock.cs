using RemoteWebControl.Services;

namespace RemoteWebControl.Tests;

internal sealed class FakeClock : IClock
{
    public long TickCount64Ms { get; private set; }
    public FakeClock(long start = 1_000_000) { TickCount64Ms = start; }
    public void Advance(TimeSpan delta) => TickCount64Ms += (long)delta.TotalMilliseconds;
    public void AdvanceMs(long ms) => TickCount64Ms += ms;
}
