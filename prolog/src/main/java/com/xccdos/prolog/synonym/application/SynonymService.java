package com.xccdos.prolog.synonym.application;

import com.xccdos.prolog.common.api.ApiException;
import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.multitenancy.TenantContext;
import com.xccdos.prolog.synonym.domain.RuleSynonymEntity;
import com.xccdos.prolog.synonym.domain.RuleSynonymRepository;
import com.xccdos.prolog.synonym.domain.SynonymStatus;
import com.xccdos.prolog.synonym.web.CreateSynonymRequest;
import com.xccdos.prolog.synonym.web.SynonymResponse;
import com.xccdos.prolog.synonym.web.UpdateSynonymRequest;
import com.xccdos.prolog.synonym.web.UpdateSynonymStatusRequest;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SynonymService {

    private final RuleSynonymRepository ruleSynonymRepository;
    private final SnowflakeIdGenerator idGenerator;
    private final TenantPublicLookupService tenantPublicLookupService;

    public SynonymService(
            RuleSynonymRepository ruleSynonymRepository,
            SnowflakeIdGenerator idGenerator,
            TenantPublicLookupService tenantPublicLookupService
    ) {
        this.ruleSynonymRepository = ruleSynonymRepository;
        this.idGenerator = idGenerator;
        this.tenantPublicLookupService = tenantPublicLookupService;
    }

    @Transactional
    public SynonymResponse createSynonym(CreateSynonymRequest request) {
        RuleSynonymEntity entity = new RuleSynonymEntity();
        entity.setId(idGenerator.nextId());
        entity.setOriginWord(request.originWord());
        entity.setSynonymWord(request.synonymWord());
        entity.setPriority(request.priority() == null ? 50 : request.priority());
        entity.setStatus(request.status() == null ? SynonymStatus.ACTIVE : SynonymStatus.fromApiValue(request.status()));
        entity.setTenantId(currentTenantIdOrNull());
        return SynonymResponse.fromEntity(ruleSynonymRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<SynonymResponse> listSynonyms(String originWord, String status) {
        return ruleSynonymRepository.findAll().stream()
                .filter(entity -> entity.getDeleteFlag() == 0)
                .filter(entity -> originWord == null || originWord.isBlank() || entity.getOriginWord().equals(originWord))
                .filter(entity -> status == null || entity.getStatus().getApiValue().equals(status))
                .sorted(Comparator.comparing(RuleSynonymEntity::getPriority).reversed()
                        .thenComparing(RuleSynonymEntity::getId))
                .map(SynonymResponse::fromEntity)
                .toList();
    }

    @Transactional
    public SynonymResponse updateSynonym(Long synonymId, UpdateSynonymRequest request) {
        RuleSynonymEntity entity = getSynonym(synonymId);
        entity.setOriginWord(request.originWord());
        entity.setSynonymWord(request.synonymWord());
        entity.setPriority(request.priority() == null ? 50 : request.priority());
        if (request.status() != null) {
            entity.setStatus(SynonymStatus.fromApiValue(request.status()));
        }
        return SynonymResponse.fromEntity(ruleSynonymRepository.save(entity));
    }

    @Transactional
    public SynonymResponse updateStatus(Long synonymId, UpdateSynonymStatusRequest request) {
        RuleSynonymEntity entity = getSynonym(synonymId);
        entity.setStatus(SynonymStatus.fromApiValue(request.status()));
        return SynonymResponse.fromEntity(ruleSynonymRepository.save(entity));
    }

    @Transactional
    public void deleteSynonym(Long synonymId) {
        RuleSynonymEntity entity = getSynonym(synonymId);
        entity.setDeleteFlag((short) 1);
        ruleSynonymRepository.save(entity);
    }

    private RuleSynonymEntity getSynonym(Long synonymId) {
        RuleSynonymEntity entity = ruleSynonymRepository.findById(synonymId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SYNONYM_NOT_FOUND", "Synonym not found"));
        if (entity.getDeleteFlag() == 1) {
            throw new ApiException(HttpStatus.NOT_FOUND, "SYNONYM_NOT_FOUND", "Synonym not found");
        }
        return entity;
    }

    private Long currentTenantIdOrNull() {
        String tenantCode = TenantContext.getCurrentTenantCode();
        if (tenantCode == null || TenantContext.PUBLIC_SCHEMA.equals(tenantCode)) {
            return null;
        }
        return tenantPublicLookupService.requireTenantId(tenantCode);
    }
}
