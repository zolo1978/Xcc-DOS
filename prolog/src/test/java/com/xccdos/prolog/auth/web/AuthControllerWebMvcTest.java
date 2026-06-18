package com.xccdos.prolog.auth.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xccdos.prolog.auth.application.AuthService;
import com.xccdos.prolog.common.api.ApiExceptionHandler;
import com.xccdos.prolog.security.JwtService;
import com.xccdos.prolog.tenant.domain.TenantRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(ApiExceptionHandler.class)
class AuthControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private JwtService jwtService;

    @MockitoBean
    private TenantRepository tenantRepository;

    @Test
    void loginReturnsAccessAndRefreshTokens() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenReturn(new AuthTokenResponse("access-token-1", "refresh-token-1"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "alice",
                                "password", "secret123",
                                "tenant_code", "acme"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token-1"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token-1"));
    }

    @Test
    void loginReturnsUnauthorizedWhenPasswordIsWrong() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new BadCredentialsException("用户名或密码错误"));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "alice",
                                "password", "wrong",
                                "tenant_code", "acme"
                        ))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_INVALID"));
    }

    @Test
    void refreshReturnsNewTokenPair() throws Exception {
        when(authService.refresh(any(RefreshTokenRequest.class)))
                .thenReturn(new AuthTokenResponse("access-token-2", "refresh-token-2"));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "refreshToken", "refresh-token-1"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("access-token-2"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token-2"));
    }
}
