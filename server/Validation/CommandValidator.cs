using System.Text.RegularExpressions;

namespace RemoteWebControl.Validation;

public static class CommandValidator
{
    private static readonly Regex IdRx     = new("^[a-zA-Z0-9_\\-:.]{1,64}$", RegexOptions.Compiled);
    private static readonly Regex NumberRx = new("^-?\\d+(\\.\\d+)?$",        RegexOptions.Compiled);
    private static readonly string[] AlertLevels = ["info", "warning", "critical"];
    private static readonly string[] SoundIds    = ["alarm", "ok"];

    private const int MaxInputValue = 1024;
    private const int MaxSelectValue = 100;
    private const int MaxFeedbackText = 500;

    public static (bool Ok, string? Error) Validate(string raw)
    {
        if (string.IsNullOrEmpty(raw)) return (false, "пустая команда");

        var colon = raw.IndexOf(':');
        var prefix = colon < 0 ? raw : raw.Substring(0, colon);
        var payload = colon < 0 ? "" : raw.Substring(colon + 1);

        return prefix switch
        {
            "CLICK"      => ValidateId(payload),
            "INPUT"      => ValidateIdValue(payload, MaxInputValue),
            "SELECT"     => ValidateIdValue(payload, MaxSelectValue),
            "TOGGLE"     => ValidateToggle(payload),
            "SLIDE"      => ValidateSlide(payload),
            "SHOW_MSG"   => ValidateFeedbackText(payload),
            "ALERT"      => ValidateAlert(payload),
            "PLAY_SOUND" => ValidatePlaySound(payload),
            _            => (false, $"неизвестный префикс '{prefix}'"),
        };
    }

    private static (bool, string?) ValidateId(string payload) =>
        IdRx.IsMatch(payload) ? (true, null) : (false, $"некорректный id '{payload}'");

    private static (bool, string?) ValidateIdValue(string payload, int maxValueLen)
    {
        var colon = payload.IndexOf(':');
        if (colon < 0) return (false, "ожидался формат <id>:<value>");
        var id = payload.Substring(0, colon);
        var value = payload.Substring(colon + 1);
        if (!IdRx.IsMatch(id))               return (false, $"некорректный id '{id}'");
        if (value.Length > maxValueLen)      return (false, $"значение длиннее {maxValueLen} символов");
        return (true, null);
    }

    private static (bool, string?) ValidateToggle(string payload)
    {
        var colon = payload.IndexOf(':');
        if (colon < 0) return (false, "ожидался формат <id>:(true|false)");
        var id = payload.Substring(0, colon);
        var value = payload.Substring(colon + 1);
        if (!IdRx.IsMatch(id))                       return (false, $"некорректный id '{id}'");
        if (value != "true" && value != "false")     return (false, $"ожидалось true|false, получено '{value}'");
        return (true, null);
    }

    private static (bool, string?) ValidateSlide(string payload)
    {
        var colon = payload.IndexOf(':');
        if (colon < 0) return (false, "ожидался формат <id>:<число>");
        var id = payload.Substring(0, colon);
        var value = payload.Substring(colon + 1);
        if (!IdRx.IsMatch(id))             return (false, $"некорректный id '{id}'");
        if (!NumberRx.IsMatch(value))      return (false, $"ожидалось число, получено '{value}'");
        return (true, null);
    }

    private static (bool, string?) ValidateFeedbackText(string payload) =>
        payload.Length <= MaxFeedbackText
            ? (true, null)
            : (false, $"текст длиннее {MaxFeedbackText} символов");

    private static (bool, string?) ValidateAlert(string payload)
    {
        var colon = payload.IndexOf(':');
        if (colon < 0) return (false, "ожидался формат <level>:<text>");
        var level = payload.Substring(0, colon);
        var text  = payload.Substring(colon + 1);
        if (Array.IndexOf(AlertLevels, level) < 0) return (false, $"уровень '{level}' не в whitelist");
        if (text.Length > MaxFeedbackText)         return (false, $"текст длиннее {MaxFeedbackText} символов");
        return (true, null);
    }

    private static (bool, string?) ValidatePlaySound(string payload) =>
        Array.IndexOf(SoundIds, payload) >= 0
            ? (true, null)
            : (false, $"sound id '{payload}' не в whitelist");
}
