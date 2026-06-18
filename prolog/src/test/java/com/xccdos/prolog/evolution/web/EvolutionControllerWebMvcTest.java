package com.xccdos.prolog.evolution.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.common.api.ApiExceptionHandler;
import com.xccdos.prolog.evolution.application.ClusteringService;
import com.xccdos.prolog.evolution.application.RuleGenerationService;
import com.xccdos.prolog.evolution.application.RuleReviewService;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskEntity;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTaskStatus;
import com.xccdos.prolog.evolution.domain.EvolutionClusterTriggerType;
import com.xccdos.prolog.evolution.domain.GeneratedRuleEntity;
import com.xccdos.prolog.evolution.domain.GeneratedRuleReviewStatus;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.multitenancy.TenantSchemaNames;
import com.xccdos.prolog.rule.domain.RulePrologEntity;
import com.xccdos.prolog.rule.domain.RuleStatus;
import com.xccdos.prolog.rule.domain.RuleType;
import com.xccdos.prolog.security.JwtService;
import com.xccdos.prolog.tenant.domain.TenantRepository;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EvolutionController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(ApiExceptionHandler.class)
class EvolutionControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ClusteringService clusteringService;

    @MockitoBean
    private RuleGenerationService ruleGenerationService;

    @MockitoBean
    private RuleReviewService ruleReviewService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private TenantRepository tenantRepository;

    @BeforeEach
    void setUpTenantContext() {
        TenantContext.setCurrentTenant("acme", TenantSchemaNames.forTenantCode("acme"));
    }

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    @WithMockUser(username = "reviewer", roles = "TENANT_ADMIN")
    void triggerClusterTaskReturnsCreatedTask() throws Exception {
        when(clusteringService.clusterTenant("acme", EvolutionClusterTriggerType.MANUAL))
                .thenReturn(clusterTask(7001L, EvolutionClusterTaskStatus.DONE));

        mockMvc.perform(post("/api/v1/evolution/cluster-tasks")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("7001"))
                .andExpect(jsonPath("$.status").value("done"))
                .andExpect(jsonPath("$.triggerType").value("manual"));
    }

    @Test
    @WithMockUser(username = "reviewer", roles = "TENANT_ADMIN")
    void listClusterTasksReturnsTenantItems() throws Exception {
        when(clusteringService.listTasks("acme"))
                .thenReturn(List.of(clusterTask(7001L, EvolutionClusterTaskStatus.DONE)));

        mockMvc.perform(get("/api/v1/evolution/cluster-tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value("7001"))
                .andExpect(jsonPath("$.items[0].status").value("done"));
    }

    @Test
    @WithMockUser(username = "reviewer", roles = "TENANT_ADMIN")
    void generateFromClusterReturnsPendingReviewCandidate() throws Exception {
        when(ruleGenerationService.generateFromCluster(7001L))
                .thenReturn(generatedRule(8101L, GeneratedRuleReviewStatus.PENDING_REVIEW, null));

        mockMvc.perform(post("/api/v1/evolution/cluster-tasks/{id}/generate", "7001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("8101"))
                .andExpect(jsonPath("$.reviewStatus").value("pending_review"));
    }

    @Test
    @WithMockUser(username = "reviewer", roles = "TENANT_ADMIN")
    void listGeneratedRulesFiltersByReviewStatus() throws Exception {
        when(ruleReviewService.listGeneratedRules("pending_review"))
                .thenReturn(List.of(generatedRule(8101L, GeneratedRuleReviewStatus.PENDING_REVIEW, null)));

        mockMvc.perform(get("/api/v1/evolution/generated-rules")
                        .queryParam("reviewStatus", "pending_review"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value("8101"))
                .andExpect(jsonPath("$.items[0].reviewStatus").value("pending_review"));

        verify(ruleReviewService).listGeneratedRules("pending_review");
    }

    @Test
    @WithMockUser(username = "reviewer", roles = "TENANT_ADMIN")
    void approvePromotesGeneratedRuleIntoFormalRule() throws Exception {
        when(ruleReviewService.approve(8101L, "reviewer"))
                .thenReturn(rule(9001L));

        mockMvc.perform(post("/api/v1/evolution/generated-rules/{id}/approve", "8101"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("9001"))
                .andExpect(jsonPath("$.ruleType").value("process"))
                .andExpect(jsonPath("$.status").value("draft"));
    }

    @Test
    @WithMockUser(username = "reviewer", roles = "TENANT_ADMIN")
    void rejectMarksGeneratedRuleRejected() throws Exception {
        when(ruleReviewService.reject(eq(8101L), eq("reviewer"), eq("命中条件不清晰")))
                .thenReturn(generatedRule(8101L, GeneratedRuleReviewStatus.REJECTED, "命中条件不清晰"));

        mockMvc.perform(post("/api/v1/evolution/generated-rules/{id}/reject", "8101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "reason", "命中条件不清晰"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("8101"))
                .andExpect(jsonPath("$.reviewStatus").value("rejected"))
                .andExpect(jsonPath("$.reviewComment").value("命中条件不清晰"));
    }

    @Test
    @WithMockUser(username = "operator", roles = "OPERATOR")
    void approveRequiresTenantAdminRole() throws Exception {
        mockMvc.perform(post("/api/v1/evolution/generated-rules/{id}/approve", "8101"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    private EvolutionClusterTaskEntity clusterTask(Long id, EvolutionClusterTaskStatus status) {
        EvolutionClusterTaskEntity entity = new EvolutionClusterTaskEntity();
        entity.setId(id);
        entity.setStatus(status);
        entity.setSampleCount(2);
        entity.setTriggerType(EvolutionClusterTriggerType.MANUAL);
        entity.setClusterResult("{\"clusters\":[]}");
        entity.setTenantId(2001L);
        return entity;
    }

    private GeneratedRuleEntity generatedRule(Long id, GeneratedRuleReviewStatus reviewStatus, String reviewComment) {
        GeneratedRuleEntity entity = new GeneratedRuleEntity();
        entity.setId(id);
        entity.setSourceClusterId(7001L);
        entity.setRuleContent("{\"ruleCode\":\"ai_refund_rule\",\"ruleName\":\"退款规则\",\"ruleType\":\"process\"}");
        entity.setConfidence("0.92");
        entity.setReviewStatus(reviewStatus);
        entity.setReviewedBy(reviewStatus == GeneratedRuleReviewStatus.PENDING_REVIEW ? null : "reviewer");
        entity.setReviewComment(reviewComment);
        entity.setLangflowRunId("langflow-run-1");
        entity.setTenantId(2001L);
        return entity;
    }

    private RulePrologEntity rule(Long id) {
        RulePrologEntity entity = new RulePrologEntity();
        entity.setId(id);
        entity.setRuleCode("ai_refund_rule");
        entity.setRuleName("退款规则");
        entity.setRuleContent("refund_rule(User).");
        entity.setRuleType(RuleType.PROCESS);
        entity.setStatus(RuleStatus.DRAFT);
        entity.setVersion(1);
        entity.setGrayRate(100);
        entity.setIsAutoGen((short) 1);
        entity.setTenantId(2001L);
        return entity;
    }
}
