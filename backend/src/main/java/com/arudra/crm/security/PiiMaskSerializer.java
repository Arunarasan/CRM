package com.arudra.crm.security;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

import java.io.IOException;

/** JSON output for identity/bank number fields: full value only for {@link Pii#callerMayReveal()}. */
public class PiiMaskSerializer extends JsonSerializer<String> {
    @Override
    public void serialize(String value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
        gen.writeString(Pii.callerMayReveal() ? value : Pii.mask(value));
    }
}
