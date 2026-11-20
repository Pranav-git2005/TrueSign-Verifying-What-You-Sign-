
package com.truesign.dto.response;

public record AnomalyDto(

        String code,

        String severity,

        String message,

        String expected,

        String actual

) {}
