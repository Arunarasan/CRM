package com.arudra.crm.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.sql.SQLIntegrityConstraintViolationException;
import java.util.stream.Collectors;

@ControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiError> handleResourceNotFoundException(
            ResourceNotFoundException ex, HttpServletRequest request) {
        
        log.warn("Resource not found: {}", ex.getMessage());
        ApiError apiError = new ApiError(
                HttpStatus.NOT_FOUND.value(),
                HttpStatus.NOT_FOUND.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(apiError, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidationExceptions(
            MethodArgumentNotValidException ex, HttpServletRequest request) {
        
        String errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        
        log.warn("Validation failed: {}", errors);
        ApiError apiError = new ApiError(
                HttpStatus.BAD_REQUEST.value(),
                "Validation Error",
                errors,
                request.getRequestURI()
        );
        return new ResponseEntity<>(apiError, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDeniedException(
            AccessDeniedException ex, HttpServletRequest request) {
        
        log.warn("Access denied: {}", ex.getMessage());
        ApiError apiError = new ApiError(
                HttpStatus.FORBIDDEN.value(),
                HttpStatus.FORBIDDEN.getReasonPhrase(),
                "You do not have permission to access this resource",
                request.getRequestURI()
        );
        return new ResponseEntity<>(apiError, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthenticationException(
            AuthenticationException ex, HttpServletRequest request) {
        
        log.warn("Authentication failed: {}", ex.getMessage());
        ApiError apiError = new ApiError(
                HttpStatus.UNAUTHORIZED.value(),
                HttpStatus.UNAUTHORIZED.getReasonPhrase(),
                "Authentication is required to access this resource",
                request.getRequestURI()
        );
        return new ResponseEntity<>(apiError, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(SQLIntegrityConstraintViolationException.class)
    public ResponseEntity<ApiError> handleSQLIntegrityConstraintViolationException(
            SQLIntegrityConstraintViolationException ex, HttpServletRequest request) {
        
        log.error("Database constraint violation: {}", ex.getMessage());
        ApiError apiError = new ApiError(
                HttpStatus.CONFLICT.value(),
                "Conflict",
                "A database integrity constraint was violated (e.g. duplicate entry).",
                request.getRequestURI()
        );
        return new ResponseEntity<>(apiError, HttpStatus.CONFLICT);
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ApiError> handleBadRequest(
            RuntimeException ex, HttpServletRequest request) {

        log.warn("Bad request: {}", ex.getMessage());
        ApiError apiError = new ApiError(
                HttpStatus.BAD_REQUEST.value(),
                HttpStatus.BAD_REQUEST.getReasonPhrase(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(apiError, HttpStatus.BAD_REQUEST);
    }

    /**
     * A constraint violation is a bad request, not a server fault — without this it fell through to
     * the generic handler and the client got an opaque 500 ("An unexpected error occurred") while the
     * real cause ("Column 'customer_id' cannot be null") stayed buried in the server log.
     */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrityViolation(
            org.springframework.dao.DataIntegrityViolationException ex, HttpServletRequest request) {

        log.warn("Data integrity violation on {}: {}", request.getRequestURI(), ex.getMostSpecificCause().getMessage());
        ApiError apiError = new ApiError(
                HttpStatus.CONFLICT.value(),
                HttpStatus.CONFLICT.getReasonPhrase(),
                "This record could not be saved because a required link or unique value is missing: "
                        + ex.getMostSpecificCause().getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(apiError, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGlobalException(
            Exception ex, HttpServletRequest request) {
        
        log.error("Unexpected error occurred: ", ex);
        ApiError apiError = new ApiError(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
                "An unexpected error occurred", // Do not expose stack traces!
                request.getRequestURI()
        );

        return new ResponseEntity<>(apiError, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
