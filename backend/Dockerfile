# Multi-stage build for Spring Boot Backend
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and package application
COPY src ./src
RUN mvn clean package -DskipTests -B

# Runtime stage
FROM eclipse-temurin:17-jre-jammy
WORKDIR /app

# Install curl for health checks & create non-root user
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -r spring && useradd -r -g spring spring

USER spring:spring

# Copy jar from build stage
COPY --from=build --chown=spring:spring /app/target/*.jar app.jar

# Expose backend port (defaults to 8080, supports Render 10000)
ENV PORT=8080
EXPOSE 8080 10000

# Production-tuned JVM flags with heap headroom and OOM safety
ENV JAVA_OPTS="-Xms512m -Xmx1536m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError"

# Application timezone. The base image is UTC; attendance/clock times use LocalTime/LocalDate/
# LocalDateTime .now(), which follow the JVM default zone — so an unset TZ makes every clock-in/out
# display hours off for India. Default to IST; override via the TZ env for another region.
ENV TZ=Asia/Kolkata

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Duser.timezone=${TZ:-Asia/Kolkata} -Dserver.port=${PORT:-8080} -Dserver.address=0.0.0.0 -jar app.jar"]

