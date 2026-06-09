using RemoteWebControl.Validation;
using Xunit;

namespace RemoteWebControl.Tests;

public class CommandValidatorTests
{
    [Theory]
    [InlineData("CLICK:btn-buy")]
    [InlineData("CLICK:a.b_c-1")]
    [InlineData("INPUT:name:Alice")]
    [InlineData("INPUT:name:")]
    [InlineData("SELECT:size:Medium")]
    [InlineData("TOGGLE:dark:true")]
    [InlineData("TOGGLE:dark:false")]
    [InlineData("SLIDE:volume:42")]
    [InlineData("SLIDE:volume:-3.14")]
    [InlineData("SHOW_MSG:hello world")]
    [InlineData("ALERT:info:hi")]
    [InlineData("ALERT:critical:!")]
    [InlineData("PLAY_SOUND:alarm")]
    [InlineData("PLAY_SOUND:ok")]
    public void Validate_AcceptsKnownCommands(string raw)
    {
        var (ok, err) = CommandValidator.Validate(raw);
        Assert.True(ok, $"expected OK but got err='{err}' for '{raw}'");
        Assert.Null(err);
    }

    [Theory]
    [InlineData("",                          "пустая команда")]
    [InlineData("UNKNOWN:foo",               "неизвестный префикс")]
    [InlineData("CLICK:bad id",              "некорректный id")]
    [InlineData("CLICK:",                    "некорректный id")]
    [InlineData("INPUT:missing-colon",       "ожидался формат")]
    [InlineData("SELECT:bad id:value",       "некорректный id")]
    [InlineData("TOGGLE:dark:maybe",         "ожидалось true|false")]
    [InlineData("TOGGLE:dark",               "ожидался формат")]
    [InlineData("SLIDE:vol:notanumber",      "ожидалось число")]
    [InlineData("SLIDE:vol",                 "ожидался формат")]
    [InlineData("ALERT:hacker:text",         "не в whitelist")]
    [InlineData("ALERT:nocolon",             "ожидался формат")]
    [InlineData("PLAY_SOUND:siren",          "не в whitelist")]
    public void Validate_RejectsBadCommands(string raw, string expectedFragment)
    {
        var (ok, err) = CommandValidator.Validate(raw);
        Assert.False(ok);
        Assert.NotNull(err);
        Assert.Contains(expectedFragment, err);
    }

    [Fact]
    public void Validate_RejectsOversizedInput()
    {
        var huge = new string('x', 2000);
        var (ok, err) = CommandValidator.Validate($"INPUT:name:{huge}");
        Assert.False(ok);
        Assert.Contains("длиннее", err);
    }

    [Fact]
    public void Validate_RejectsOversizedShowMsg()
    {
        var huge = new string('x', 600);
        var (ok, err) = CommandValidator.Validate($"SHOW_MSG:{huge}");
        Assert.False(ok);
        Assert.Contains("длиннее", err);
    }
}
