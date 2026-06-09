namespace RemoteWebControl.Services;

public interface IClock
{
    long TickCount64Ms { get; }
}

public sealed class SystemClock : IClock
{
    public long TickCount64Ms => Environment.TickCount64;
}
