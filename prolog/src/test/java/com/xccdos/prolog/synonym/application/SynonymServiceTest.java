package com.xccdos.prolog.synonym.application;

import com.xccdos.prolog.common.id.SnowflakeIdGenerator;
import com.xccdos.prolog.synonym.domain.RuleSynonymEntity;
import com.xccdos.prolog.synonym.domain.RuleSynonymRepository;
import com.xccdos.prolog.synonym.domain.SynonymStatus;
import com.xccdos.prolog.tenant.application.TenantPublicLookupService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SynonymServiceTest {

    @Mock
    private RuleSynonymRepository ruleSynonymRepository;

    @Mock
    private SnowflakeIdGenerator snowflakeIdGenerator;

    @Mock
    private TenantPublicLookupService tenantPublicLookupService;

    @InjectMocks
    private SynonymService synonymService;

    @Test
    void listSynonymsSortsByPriorityDescending() {
        RuleSynonymEntity low = new RuleSynonymEntity();
        low.setId(1L);
        low.setOriginWord("订单");
        low.setSynonymWord("工单");
        low.setPriority(10);
        low.setStatus(SynonymStatus.ACTIVE);

        RuleSynonymEntity high = new RuleSynonymEntity();
        high.setId(2L);
        high.setOriginWord("订单");
        high.setSynonymWord("单据");
        high.setPriority(90);
        high.setStatus(SynonymStatus.ACTIVE);

        when(ruleSynonymRepository.findAll()).thenReturn(List.of(low, high));

        var responses = synonymService.listSynonyms("订单", null);

        assertThat(responses).hasSize(2);
        assertThat(responses.getFirst().synonymWord()).isEqualTo("单据");
        assertThat(responses.getFirst().priority()).isEqualTo(90);
    }
}
