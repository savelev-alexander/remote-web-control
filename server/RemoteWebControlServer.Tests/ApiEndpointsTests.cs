using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using RemoteWebControl.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace RemoteWebControl.Tests;

public class ApiEndpointsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };
    private readonly WebApplicationFactory<Program> _factory;

    public ApiEndpointsTests(WebApplicationFactory<Program> factory) { _factory = factory; }

    private HttpClient Client() => _factory.CreateClient();

    private async Task<string> CreateSession()
    {
        var client = Client();
        var resp = await client.PostAsync("/api/session", new StringContent("{}", System.Text.Encoding.UTF8, "application/json"));
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<SessionResponse>(Json);
        Assert.NotNull(body);
        Assert.False(string.IsNullOrEmpty(body!.SessionId));
        return body.SessionId;
    }

    [Fact]
    public async Task PostSession_Returns200_WithSessionId()
    {
        var sid = await CreateSession();
        Assert.NotEmpty(sid);
    }

    [Fact]
    public async Task PostExecute_Returns404_WhenSessionMissing()
    {
        var client = Client();
        var resp = await client.PostAsJsonAsync("/api/execute",
            new ExecuteRequest("ghost", new[] { "CLICK:a" }));
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task PostExecute_Returns400_OnEmptySteps()
    {
        var sid = await CreateSession();
        var client = Client();
        var resp = await client.PostAsJsonAsync("/api/execute",
            new ExecuteRequest(sid, Array.Empty<string>()));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task PostExecute_Returns400_OnInvalidPrefix()
    {
        var sid = await CreateSession();
        var client = Client();
        var resp = await client.PostAsJsonAsync("/api/execute",
            new ExecuteRequest(sid, new[] { "DELETE_DB:everything" }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task PostExecute_Returns400_OnBadId()
    {
        var sid = await CreateSession();
        var client = Client();
        var resp = await client.PostAsJsonAsync("/api/execute",
            new ExecuteRequest(sid, new[] { "CLICK:has spaces" }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task PostExecute_Returns400_OnSlideNonNumeric()
    {
        var sid = await CreateSession();
        var client = Client();
        var resp = await client.PostAsJsonAsync("/api/execute",
            new ExecuteRequest(sid, new[] { "SLIDE:vol:loud" }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task PostExecute_RoundTrip_ViaPoll()
    {
        var sid = await CreateSession();
        var client = Client();

        var exec = await client.PostAsJsonAsync("/api/execute",
            new ExecuteRequest(sid, new[] { "CLICK:btn-buy", "SHOW_MSG:done" }));
        exec.EnsureSuccessStatusCode();

        var poll = await client.GetAsync($"/api/poll?session_id={sid}");
        poll.EnsureSuccessStatusCode();
        var got = await poll.Content.ReadFromJsonAsync<PollResponse>(Json);
        Assert.NotNull(got);
        Assert.Equal(new[] { "CLICK:btn-buy", "SHOW_MSG:done" }, got!.Commands);
    }

    [Fact]
    public async Task GetPoll_Returns404_WhenSessionMissing()
    {
        var client = Client();
        var resp = await client.GetAsync("/api/poll?session_id=ghost");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task GetPoll_Returns200_EmptyArray_WhenIdle()
    {
        var sid = await CreateSession();
        var client = Client();
        var resp = await client.GetAsync($"/api/poll?session_id={sid}");
        resp.EnsureSuccessStatusCode();
        var got = await resp.Content.ReadFromJsonAsync<PollResponse>(Json);
        Assert.NotNull(got);
        Assert.Empty(got!.Commands);
    }

    [Fact]
    public async Task GetPoll_Returns400_OnMissingParam()
    {
        var client = Client();
        var resp = await client.GetAsync("/api/poll");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task PutRegistry_Returns404_WhenSessionMissing()
    {
        var client = Client();
        var resp = await client.PutAsJsonAsync("/api/registry/ghost",
            new PutRegistryRequest(1, new[] { Btn("a") }));
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task PutRegistry_Returns400_OnDuplicateIds()
    {
        var sid = await CreateSession();
        var client = Client();
        var resp = await client.PutAsJsonAsync($"/api/registry/{sid}",
            new PutRegistryRequest(1, new[] { Btn("a"), Btn("a") }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task PutRegistry_Returns400_OnSelectMissingOptions()
    {
        var sid = await CreateSession();
        var client = Client();
        var el = new RegistryElement("s1", "select", "Size", null, null, null, null, null);
        var resp = await client.PutAsJsonAsync($"/api/registry/{sid}",
            new PutRegistryRequest(1, new[] { el }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task PutRegistry_Returns400_OnSliderInvertedRange()
    {
        var sid = await CreateSession();
        var client = Client();
        var el = new RegistryElement("v", "slider", "Vol", null, null, 10, 5, 1);
        var resp = await client.PutAsJsonAsync($"/api/registry/{sid}",
            new PutRegistryRequest(1, new[] { el }));
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task PutThenGet_ReflectsLatestSnapshot()
    {
        var sid = await CreateSession();
        var client = Client();
        var put = await client.PutAsJsonAsync($"/api/registry/{sid}",
            new PutRegistryRequest(7, new[] { Btn("a"), Btn("b") }));
        put.EnsureSuccessStatusCode();

        var get = await client.GetAsync($"/api/registry/{sid}");
        get.EnsureSuccessStatusCode();
        var body = await get.Content.ReadFromJsonAsync<RegistryResponse>(Json);
        Assert.NotNull(body);
        Assert.Equal(7, body!.Version);
        Assert.Equal(2, body.Elements.Length);
    }

    [Fact]
    public async Task GetRegistry_ReturnsEmpty_BeforeFirstPut()
    {
        var sid = await CreateSession();
        var client = Client();
        var resp = await client.GetAsync($"/api/registry/{sid}");
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<RegistryResponse>(Json);
        Assert.NotNull(body);
        Assert.Equal(0, body!.Version);
        Assert.Empty(body.Elements);
    }

    [Fact]
    public async Task DeleteRegistry_ClearsSnapshot()
    {
        var sid = await CreateSession();
        var client = Client();
        await client.PutAsJsonAsync($"/api/registry/{sid}",
            new PutRegistryRequest(1, new[] { Btn("a") }));

        var del = await client.DeleteAsync($"/api/registry/{sid}");
        del.EnsureSuccessStatusCode();

        var get = await client.GetAsync($"/api/registry/{sid}");
        get.EnsureSuccessStatusCode();
        var body = await get.Content.ReadFromJsonAsync<RegistryResponse>(Json);
        Assert.Equal(0, body!.Version);
    }

    [Fact]
    public async Task GetServerIp_Returns200()
    {
        var client = Client();
        var resp = await client.GetAsync("/api/server-ip");
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<ServerIpResponse>(Json);
        Assert.NotNull(body);
        Assert.False(string.IsNullOrEmpty(body!.Ip));
    }

    [Fact]
    public async Task Health_Returns200() =>
        Assert.Equal(HttpStatusCode.OK, (await Client().GetAsync("/health")).StatusCode);

    [Fact]
    public async Task Ready_Returns200() =>
        Assert.Equal(HttpStatusCode.OK, (await Client().GetAsync("/ready")).StatusCode);

    private static RegistryElement Btn(string id) =>
        new(id, "button", $"L-{id}", null, null, null, null, null);
}
