package com.arudra.crm.util;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Persists a {@code List<String>} as a single newline-delimited TEXT column and back.
 * Used for simple string lists on the website catalog (e.g. material applications,
 * service benefits) so they need no child table. Order is preserved; blanks are dropped.
 */
@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

    private static final String DELIM = "\n";

    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        if (attribute == null || attribute.isEmpty()) return "";
        return attribute.stream()
                .filter(s -> s != null && !s.isBlank())
                .collect(Collectors.joining(DELIM));
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) return List.of();
        return Arrays.stream(dbData.split(DELIM))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
    }
}
