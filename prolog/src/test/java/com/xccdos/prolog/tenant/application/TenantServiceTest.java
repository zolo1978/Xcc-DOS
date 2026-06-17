package com.xccdos.prolog.tenant.application;

import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.tenant.domain.TenantEntity;
import com.xccdos.prolog.tenant.domain.TenantRepository;
import com.xccdos.prolog.tenant.infrastructure.TenantSchemaManager;
import com.xccdos.prolog.tenant.web.CreateTenantRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantServiceTest {

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private TenantSchemaManager tenantSchemaManager;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @InjectMocks
    private TenantService tenantService;

    @Test
    void createTenantCreatesSchemaAndPersistsMetadata() {
        CreateTenantRequest request = new CreateTenantRequest("Acme", "acme", "schema", null, null, null);
        when(snowflakeIdGenerator.nextId()).thenReturn(1001L);
        when(tenantRepository.save(any(TenantEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        tenantService.createTenant(request);

        verify(tenantSchemaManager).createSchemaForTenant("acme");
        ArgumentCaptor<TenantEntity> captor = ArgumentCaptor.forClass(TenantEntity.class);
        verify(tenantRepository).save(captor.capture());
        assertThat(captor.getValue().getTenantCode()).isEqualTo("acme");
        assertThat(captor.getValue().getId()).isEqualTo(1001L);
    }
}
