using System.Text.RegularExpressions;
using RemoteWebControl.Models;
using RemoteWebControl.Services;
using RemoteWebControl.Validation;

namespace RemoteWebControl.Endpoints;

public static class ApiEndpoints
{
    private const int MaxSteps              = 32;
    private const int MaxStepLength         = 1536;
    private const int MaxRegistryElements   = 256;
    private const int MaxLabelLength        = 200;
    private const int MaxGroupLength        = 100;
    private const int MaxOptions            = 32;
    private const int MaxOptionLength       = 100;

    private static readonly Regex IdRx = new("^[a-zA-Z0-9_\\-:.]{1,64}$", RegexOptions.Compiled);
    private static readonly string[] AllowedKinds = ["button", "input", "select", "toggle", "slider"];

    public static void MapApiEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api");

        api.MapPost("/session", (SessionStore store) =>
            Results.Ok(new SessionResponse(store.CreateSession())));

        api.MapPost("/execute", (ExecuteRequest req, SessionStore store) =>
        {
            if (!store.SessionExists(req.SessionId))    return NotFnd("сессия не найдена");
            if (req.Steps is not { Length: > 0 })       return BadReq("требуется массив steps");
            if (req.Steps.Length > MaxSteps)            return BadReq($"слишком много шагов (максимум {MaxSteps})");
            foreach (var s in req.Steps)
            {
                if (s is null || s.Length > MaxStepLength)
                    return BadReq($"длина шага превышает {MaxStepLength} символов");
                var (ok, err) = CommandValidator.Validate(s);
                if (!ok) return BadReq($"невалидная команда '{s}': {err}");
            }

            store.AddCommands(req.SessionId, req.Steps);
            return Results.Ok(new ExecuteResponse("ok"));
        });

        api.MapGet("/poll", (string? session_id, SessionStore store) =>
        {
            if (string.IsNullOrEmpty(session_id))       return BadReq("требуется параметр session_id");
            if (!store.SessionExists(session_id))       return NotFnd("сессия не найдена");

            return Results.Ok(new PollResponse(store.FetchCommands(session_id)));
        });

        api.MapGet("/server-ip", (ServerIpResponse cached) => Results.Ok(cached));

        api.MapPut("/registry/{session_id}", (string session_id, PutRegistryRequest req,
                                              SessionStore sessions, RegistryStore registry) =>
        {
            if (!sessions.SessionExists(session_id))    return NotFnd("сессия не найдена");
            var (ok, err) = ValidateRegistry(req.Elements);
            if (!ok) return BadReq(err!);
            registry.Put(session_id, req.Version, req.Elements);
            return Results.Ok(new PutRegistryResponse("ok", req.Version));
        });

        api.MapGet("/registry/{session_id}", (string session_id,
                                              SessionStore sessions, RegistryStore registry) =>
        {
            if (!sessions.SessionExists(session_id))    return NotFnd("сессия не найдена");
            var snap = registry.Get(session_id);
            return Results.Ok(snap is null
                ? new RegistryResponse(0, Array.Empty<RegistryElement>())
                : new RegistryResponse(snap.Version, snap.Elements));
        });

        api.MapDelete("/registry/{session_id}", (string session_id,
                                                 SessionStore sessions, RegistryStore registry) =>
        {
            if (!sessions.SessionExists(session_id))    return NotFnd("сессия не найдена");
            registry.Drop(session_id);
            return Results.Ok(new ExecuteResponse("ok"));
        });
    }

    private static (bool Ok, string? Error) ValidateRegistry(RegistryElement[]? elements)
    {
        if (elements is null) return (false, "требуется массив elements");
        if (elements.Length > MaxRegistryElements)
            return (false, $"слишком много элементов (максимум {MaxRegistryElements})");

        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var e in elements)
        {
            if (e is null)                                           return (false, "элемент равен null");
            if (string.IsNullOrEmpty(e.Id) || !IdRx.IsMatch(e.Id))   return (false, $"некорректный id '{e.Id}'");
            if (!seen.Add(e.Id))                                     return (false, $"дублирующийся id '{e.Id}'");
            if (string.IsNullOrEmpty(e.Label) || e.Label.Length > MaxLabelLength)
                return (false, $"label у '{e.Id}' пуст или длиннее {MaxLabelLength}");
            if (e.Group is { Length: > 0 } g && g.Length > MaxGroupLength)
                return (false, $"group у '{e.Id}' длиннее {MaxGroupLength}");
            if (Array.IndexOf(AllowedKinds, e.Kind) < 0)
                return (false, $"kind '{e.Kind}' у '{e.Id}' не в whitelist");

            if (e.Kind == "select")
            {
                if (e.Options is not { Length: > 0 })            return (false, $"у '{e.Id}' нет options");
                if (e.Options.Length > MaxOptions)               return (false, $"у '{e.Id}' слишком много options");
                foreach (var o in e.Options)
                    if (o is null || o.Length > MaxOptionLength)
                        return (false, $"option у '{e.Id}' длиннее {MaxOptionLength}");
            }

            if (e.Kind == "slider")
            {
                if (e.Min is null || e.Max is null)                       return (false, $"у slider '{e.Id}' нет min/max");
                if (!double.IsFinite(e.Min.Value) || !double.IsFinite(e.Max.Value))
                    return (false, $"у slider '{e.Id}' нефинитные min/max");
                if (e.Min.Value >= e.Max.Value)                           return (false, $"у slider '{e.Id}' min >= max");
                if (e.Step is { } step && (!double.IsFinite(step) || step <= 0))
                    return (false, $"у slider '{e.Id}' некорректный step");
            }
        }

        return (true, null);
    }

    private static IResult BadReq(string message) => Results.BadRequest(new ErrorResponse(message));
    private static IResult NotFnd(string message) => Results.NotFound(new ErrorResponse(message));
}
