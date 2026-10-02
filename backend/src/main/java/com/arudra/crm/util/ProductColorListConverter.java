package com.arudra.crm.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.List;

/**
 * Persists a product's colour options as a JSON array in one TEXT column:
 * {@code [{"name":"Ivory","hex":"#f4efe2","imageUrl":"..."}]}. Unnamed entries are dropped.
 */
@Converter
public class ProductColorListConverter implements AttributeConverter<List<ProductColorListConverter.ProductColor>, String> {

    public record ProductColor(String name, String hex, String imageUrl) {}

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(List<ProductColor> attribute) {
        if (attribute == null) return null;
        List<ProductColor> clean = attribute.stream()
                .filter(c -> c != null && c.name() != null && !c.name().isBlank())
                .map(c -> new ProductColor(c.name().trim(), blankToNull(c.hex()), blankToNull(c.imageUrl())))
                .toList();
        if (clean.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(clean);
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not save product colours", e);
        }
    }

    @Override
    public List<ProductColor> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) return new ArrayList<>();
        try {
            return MAPPER.readValue(dbData, new TypeReference<List<ProductColor>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
