package com.xccdos.prolog.tenant.application;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.tenant.domain.TenantDbStatus;
import com.xccdos.prolog.tenant.domain.TenantEntity;
import com.xccdos.prolog.tenant.domain.TenantIsolationType;
import com.xccdos.prolog.tenant.domain.TenantRepository;
import com.xccdos.prolog.tenant.domain.TenantRuntimeStatus;
import com.xccdos.prolog.tenant.infrastructure.TenantSchemaManager;
import com.xccdos.prolog.tenant.web.CreateTenantRequest;
import com.xccdos.prolog.tenant.web.TenantResponse;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TenantService {

    private final TenantRepository tenantRepository;
    private final TenantSchemaManager tenantSchemaManager;
    private final SnowflakeIdGenerator idGenerator;

    public TenantService(
            TenantRepository tenantRepository,
            TenantSchemaManager tenantSchemaManager,
            SnowflakeIdGenerator idGenerator
    ) {
        this.tenantRepository = tenantRepository;
        this.tenantSchemaManager = tenantSchemaManager;
        this.idGenerator = idGenerator;
    }

    @Transactional
    public TenantResponse createTenant(CreateTenantRequest request) {
        if (tenantRepository.existsByTenantCode(request.code())) {
            throw new ApiException(HttpStatus.CONFLICT, "TENANT_CODE_EXISTS", "Tenant code already exists");
        }
        TenantEntity tenant = new TenantEntity();
        tenant.setId(idGenerator.nextId());
        tenant.setTenantName(request.name());
        tenant.setTenantCode(request.code());
        tenant.setIsolateType(TenantIsolationType.fromApiValue(request.isolateType()));
        tenant.setStatus(TenantDbStatus.NORMAL);
        tenant.setExpireTime(request.expireTime());
        tenant.setContactPerson(request.contactPerson());
        tenant.setContactPhone(request.contactPhone());

        tenantSchemaManager.createSchemaForTenant(request.code());
        return TenantResponse.fromEntity(tenantRepository.save(tenant));
    }

    @Transactional(readOnly = true)
    public List<TenantResponse> listTenants(String status) {
        return tenantRepository.findAll()
                .stream()
                .filter(tenant -> status == null || TenantRuntimeStatus.fromEntity(tenant).getApiValue().equals(status))
                .map(TenantResponse::fromEntity)
                .toList();
    }

    @Transactional
    public TenantResponse updateStatus(Long tenantId, String statusValue) {
        TenantEntity tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TENANT_NOT_FOUND", "Tenant not found"));
        TenantRuntimeStatus runtimeStatus = TenantRuntimeStatus.fromApiValue(statusValue);
        if (runtimeStatus == TenantRuntimeStatus.INACTIVE) {
            tenant.setStatus(TenantDbStatus.DISABLED);
        } else if (runtimeStatus == TenantRuntimeStatus.EXPIRED) {
            tenant.setStatus(TenantDbStatus.NORMAL);
            tenant.setExpireTime(OffsetDateTime.now());
        } else {
            tenant.setStatus(TenantDbStatus.NORMAL);
            if (tenant.getExpireTime() != null && tenant.getExpireTime().isBefore(OffsetDateTime.now())) {
                tenant.setExpireTime(null);
            }
        }
        return TenantResponse.fromEntity(tenantRepository.save(tenant));
    }
}
