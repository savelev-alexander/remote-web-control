
using System.Text.Json.Serialization;

namespace RemoteWebControl.Models;

public record SessionResponse(
    [property: JsonPropertyName("session_id")] string SessionId
);

public record ExecuteRequest(
    [property: JsonPropertyName("session_id")] string SessionId,
    [property: JsonPropertyName("steps")] string[] Steps
);

public record ExecuteResponse(
    [property: JsonPropertyName("status")] string Status
);

public record PollResponse(
    [property: JsonPropertyName("commands")] string[] Commands
);

public record ErrorResponse(
    [property: JsonPropertyName("error")] string Error
);

public record SessionConfig(int TtlMinutes, int MaxSessions);

public record ServerIpResponse(
    [property: JsonPropertyName("ip")] string Ip
);

public record RegistryElement(
    [property: JsonPropertyName("id")]      string  Id,
    [property: JsonPropertyName("kind")]    string  Kind,
    [property: JsonPropertyName("label")]   string  Label,
    [property: JsonPropertyName("group")]   string? Group,
    [property: JsonPropertyName("options")] string[]? Options,
    [property: JsonPropertyName("min")]     double? Min,
    [property: JsonPropertyName("max")]     double? Max,
    [property: JsonPropertyName("step")]    double? Step
);

public record PutRegistryRequest(
    [property: JsonPropertyName("version")]  long Version,
    [property: JsonPropertyName("elements")] RegistryElement[] Elements
);

public record PutRegistryResponse(
    [property: JsonPropertyName("status")]  string Status,
    [property: JsonPropertyName("version")] long Version
);

public record RegistryResponse(
    [property: JsonPropertyName("version")]  long Version,
    [property: JsonPropertyName("elements")] RegistryElement[] Elements
);
