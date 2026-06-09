using System.Text.Json.Serialization;

namespace RemoteWebControl.Models;

[JsonSerializable(typeof(SessionResponse))]
[JsonSerializable(typeof(ExecuteRequest))]
[JsonSerializable(typeof(ExecuteResponse))]
[JsonSerializable(typeof(PollResponse))]
[JsonSerializable(typeof(ErrorResponse))]
[JsonSerializable(typeof(ServerIpResponse))]
[JsonSerializable(typeof(RegistryElement))]
[JsonSerializable(typeof(RegistryElement[]))]
[JsonSerializable(typeof(PutRegistryRequest))]
[JsonSerializable(typeof(PutRegistryResponse))]
[JsonSerializable(typeof(RegistryResponse))]
public partial class AppJsonContext : JsonSerializerContext { }
