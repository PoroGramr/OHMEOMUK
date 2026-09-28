FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q test && mvn -q package -DskipTests

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN useradd --system --uid 10001 --create-home appuser
COPY --from=build --chown=appuser:appuser /build/target/backend-*.jar /app/app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
