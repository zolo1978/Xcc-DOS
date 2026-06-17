package com.xccdos.prolog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.multitenancy.TenantSchemaNames;
import com.xccdos.prolog.session.application.SessionService;
import com.xccdos.prolog.session.domain.UserSessionEntity;
import com.xccdos.prolog.session.domain.UserSessionRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.Instant;
import java.util.Map;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class TenantRuleIntegrationTest {

    private static final String JWT_SECRET = "integration-secret-integration-secret-1234";
    private static final String ISSUER = "prolog-agentteam-test";

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:14")
            .withDatabaseName("prolog_test")
            .withUsername("postgres")
            .withPassword("postgres");

    @DynamicPropertySource
    static void configure(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("prolog.jwt.secret", () -> JWT_SECRET);
        registry.add("prolog.jwt.issuer", () -> ISSUER);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SessionService sessionService;

    @Autowired
    private UserSessionRepository userSessionRepository;

    private SecretKey secretKey;

    @BeforeEach
    void setUp() {
        this.secretKey = Keys.hmacShaKeyFor(JWT_SECRET.getBytes(StandardCharsets.UTF_8));
    }

    @Test
    void keepsRulesIsolatedPerTenantSchema() throws Exception {
        createTenant("acme_iso");
        createTenant("beta_iso");

        createRule("acme_iso", "acme_rule", "Acme Rule");
        createRule("beta_iso", "beta_rule", "Beta Rule");

        mockMvc.perform(get("/api/v1/rules")
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_iso"))
                        .header("X-Tenant-Id", "acme_iso"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].ruleCode", is("acme_rule")));

        mockMvc.perform(get("/api/v1/rules")
                        .header(HttpHeaders.AUTHORIZATION, bearer("beta_iso"))
                        .header("X-Tenant-Id", "beta_iso"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].ruleCode", is("beta_rule")));
    }

    @Test
    void rejectsWhenTenantHeaderDoesNotMatchJwtClaim() throws Exception {
        createTenant("acme_hdr");
        createTenant("beta_hdr");

        mockMvc.perform(post("/api/v1/rules")
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_hdr"))
                        .header("X-Tenant-Id", "beta_hdr")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ruleCode", "mismatch_rule",
                                "ruleName", "Mismatch Rule",
                                "ruleContent", "valid(a).",
                                "ruleType", "process"
                        ))))
                .andExpect(status().isForbidden());
    }

    @Test
    void supportsRuleCrudLifecycleAndGrayRate() throws Exception {
        createTenant("acme_life");

        String id = createRule("acme_life", "life_rule", "Lifecycle Rule");

        mockMvc.perform(put("/api/v1/rules/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_life"))
                        .header("X-Tenant-Id", "acme_life")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ruleCode", "life_rule",
                                "ruleName", "Lifecycle Rule V2",
                                "ruleContent", "valid(v2).",
                                "ruleType", "validation"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version", is(2)));

        mockMvc.perform(patch("/api/v1/rules/{id}/status", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_life"))
                        .header("X-Tenant-Id", "acme_life")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"active\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("active")));

        mockMvc.perform(patch("/api/v1/rules/{id}/status", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_life"))
                        .header("X-Tenant-Id", "acme_life")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"gray\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("gray")));

        mockMvc.perform(patch("/api/v1/rules/{id}/gray-rate", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_life"))
                        .header("X-Tenant-Id", "acme_life")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"grayRate\":30}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grayRate", is(30)));

        mockMvc.perform(patch("/api/v1/rules/{id}/status", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_life"))
                        .header("X-Tenant-Id", "acme_life")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"inactive\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("inactive")));
    }

    @Test
    void supportsSnapshotRollbackAcrossGrayRelease() throws Exception {
        createTenant("acme_snap");

        String id = createRule("acme_snap", "snap_rule", "Snapshot Rule");

        mockMvc.perform(put("/api/v1/rules/{id}", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_snap"))
                        .header("X-Tenant-Id", "acme_snap")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ruleCode", "snap_rule",
                                "ruleName", "Snapshot Rule V2",
                                "ruleContent", "valid(v2).",
                                "ruleType", "validation"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version", is(2)));

        mockMvc.perform(patch("/api/v1/rules/{id}/publish/gray", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_snap"))
                        .header("X-Tenant-Id", "acme_snap")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"grayRate\":35}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("gray")))
                .andExpect(jsonPath("$.version", is(3)));

        mockMvc.perform(post("/api/v1/rules/{id}/rollback", id)
                        .header(HttpHeaders.AUTHORIZATION, bearer("acme_snap"))
                        .header("X-Tenant-Id", "acme_snap")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ruleContent", is("valid(v2).")))
                .andExpect(jsonPath("$.version", is(4)));
    }

    @Test
    void marksSessionTimeoutWhenExpired() {
        createTenantQuietly("acme_session");
        TenantContext.setCurrentTenant("acme_session", TenantSchemaNames.forTenantCode("acme_session"));
        try {
            var created = sessionService.createSession("10.0.0.1", "draft", "{\"step\":1}");
            UserSessionEntity entity = userSessionRepository.findBySessionIdAndDeleteFlag(created.sessionId(), (short) 0)
                    .orElseThrow();
            entity.setExpireTime(OffsetDateTime.now().minusMinutes(1));
            userSessionRepository.save(entity);

            var reconnected = sessionService.reconnect(created.sessionId());

            assertThat(reconnected.sessionStatus()).isEqualTo("timeout");
        } finally {
            TenantContext.clear();
        }
    }

    private void createTenantQuietly(String code) {
        try {
            createTenant(code);
        } catch (Exception exception) {
            throw new RuntimeException(exception);
        }
    }

    private void createTenant(String code) throws Exception {
        mockMvc.perform(post("/api/v1/tenants")
                        .header(HttpHeaders.AUTHORIZATION, bearer("public"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", code.toUpperCase(),
                                "code", code,
                                "isolateType", "schema"
                        ))))
                .andExpect(status().isCreated());
    }

    private String createRule(String tenantCode, String ruleCode, String ruleName) throws Exception {
        String response = mockMvc.perform(post("/api/v1/rules")
                        .header(HttpHeaders.AUTHORIZATION, bearer(tenantCode))
                        .header("X-Tenant-Id", tenantCode)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "ruleCode", ruleCode,
                                "ruleName", ruleName,
                                "ruleContent", "valid(" + ruleCode + ").",
                                "ruleType", "process"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status", is("draft")))
                .andExpect(jsonPath("$.version", is(1)))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode node = objectMapper.readTree(response);
        return node.get("id").asText();
    }

    private String bearer(String tenant) {
        return "Bearer " + Jwts.builder()
                .issuer(ISSUER)
                .subject("tester")
                .claim("tenant", tenant)
                .issuedAt(java.util.Date.from(Instant.now()))
                .expiration(java.util.Date.from(Instant.now().plusSeconds(3600)))
                .signWith(secretKey)
                .compact();
    }
}
