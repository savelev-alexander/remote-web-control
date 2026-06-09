
using System.Globalization;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using RemoteWebControl.Endpoints;
using RemoteWebControl.Models;
using RemoteWebControl.Services;
using Microsoft.AspNetCore.StaticFiles;

var sessionConfig = new SessionConfig(
    TtlMinutes:  EnvInt("SESSION_TTL_MINUTES", fallback: 30),
    MaxSessions: EnvInt("MAX_SESSIONS",        fallback: 500));

var port = EnvInt("PORT", fallback: 8080, min: 1, max: 65535);

var publicHost = Env("PUBLIC_HOST", "");
var serverIp = publicHost.Length > 0 ? publicHost : DetectLanIp();

var builder = WebApplication.CreateSlimBuilder(args);

builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));

builder.WebHost.ConfigureKestrel(opts =>
    opts.Limits.MaxRequestBodySize = 64 * 1024);

builder.Services.AddSingleton(sessionConfig);
builder.Services.AddSingleton(new ServerIpResponse(serverIp));
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<SessionStore>();
builder.Services.AddSingleton<RegistryStore>();

builder.Services.AddCors(o =>
    o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();
var log = app.Services.GetRequiredService<ILogger<Program>>();

var sessionStore  = app.Services.GetRequiredService<SessionStore>();
var registryStore = app.Services.GetRequiredService<RegistryStore>();
sessionStore.SessionEvicted += sid => registryStore.Drop(sid);

log.LogInformation(
    "Конфиг: port={Port}, ip={Ip}, ttl={Ttl}мин, maxSessions={MaxSessions}",
    port, serverIp, sessionConfig.TtlMinutes, sessionConfig.MaxSessions);

app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions { OnPrepareResponse = SetCacheHeaders });

app.MapApiEndpoints();

app.MapGet("/health", () => Results.Text("OK"));
app.MapGet("/ready",  () => Results.Text("READY"));

app.Run($"http://0.0.0.0:{port}");

static string Env(string key, string fallback) =>
    Environment.GetEnvironmentVariable(key)?.Trim() is { Length: > 0 } v ? v : fallback;

static int EnvInt(string key, int fallback, int min = 1, int max = int.MaxValue) =>
    int.TryParse(Environment.GetEnvironmentVariable(key), out var v) && v >= min && v <= max
        ? v
        : fallback;

static string DetectLanIp()
{
    var candidates = NetworkInterface.GetAllNetworkInterfaces()
        .Where(n => n.OperationalStatus == OperationalStatus.Up
                 && n.NetworkInterfaceType is NetworkInterfaceType.Ethernet
                                           or NetworkInterfaceType.Wireless80211)
        .SelectMany(n => n.GetIPProperties().UnicastAddresses)
        .Select(a => a.Address)
        .Where(a => a.AddressFamily == AddressFamily.InterNetwork && IsRfc1918(a))
        .ToList();

    if (candidates.Count == 0) return "127.0.0.1";
    if (candidates.Count == 1) return candidates[0].ToString();

    try
    {
        using var socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, ProtocolType.Udp);
        socket.Connect("8.8.8.8", 53);
        if (socket.LocalEndPoint is IPEndPoint ep)
        {
            var match = candidates.FirstOrDefault(a => a.Equals(ep.Address));
            if (match is not null) return match.ToString();
        }
    }
    catch { }

    return candidates.OrderBy(PrivateRangePriority).First().ToString();
}

static bool IsRfc1918(IPAddress addr)
{
    var b = addr.GetAddressBytes();
    return (b[0] == 192 && b[1] == 168)
        || (b[0] == 10)
        || (b[0] == 172 && b[1] >= 16 && b[1] <= 31);
}

static int PrivateRangePriority(IPAddress addr)
{
    var b = addr.GetAddressBytes();
    if (b[0] == 192 && b[1] == 168) return 0;
    if (b[0] == 10) return 1;
    return 2;
}

static void SetCacheHeaders(StaticFileResponseContext ctx)
{
    var path = ctx.Context.Request.Path.Value ?? "";
    ctx.Context.Response.Headers.CacheControl =
        path.Contains("/assets/", StringComparison.Ordinal)
            ? "public, max-age=31536000, immutable"
            : "no-cache, must-revalidate";
}
