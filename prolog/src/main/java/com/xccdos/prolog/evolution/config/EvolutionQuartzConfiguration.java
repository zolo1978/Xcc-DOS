package com.xccdos.prolog.evolution.config;

import org.quartz.JobDetail;
import org.quartz.Trigger;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.quartz.CronTriggerFactoryBean;
import org.springframework.scheduling.quartz.MethodInvokingJobDetailFactoryBean;

@Configuration
@ConditionalOnProperty(prefix = "prolog.evolution.clustering", name = "enabled", havingValue = "true")
public class EvolutionQuartzConfiguration {

    @Bean
    public MethodInvokingJobDetailFactoryBean evolutionClusteringJobDetailFactory(EvolutionScheduledLauncher launcher) {
        MethodInvokingJobDetailFactoryBean factoryBean = new MethodInvokingJobDetailFactoryBean();
        factoryBean.setTargetObject(launcher);
        factoryBean.setTargetMethod("runScheduledClustering");
        factoryBean.setConcurrent(false);
        factoryBean.setName("evolutionClusteringJob");
        return factoryBean;
    }

    @Bean
    public JobDetail evolutionClusteringJobDetail(MethodInvokingJobDetailFactoryBean factoryBean) throws Exception {
        factoryBean.afterPropertiesSet();
        return (JobDetail) factoryBean.getObject();
    }

    @Bean
    public CronTriggerFactoryBean evolutionClusteringTrigger(JobDetail evolutionClusteringJobDetail, EvolutionProperties properties) {
        CronTriggerFactoryBean factoryBean = new CronTriggerFactoryBean();
        factoryBean.setJobDetail(evolutionClusteringJobDetail);
        factoryBean.setCronExpression(properties.getClustering().getCron());
        factoryBean.setName("evolutionClusteringTrigger");
        return factoryBean;
    }

    @Bean
    public EvolutionScheduledLauncher evolutionScheduledLauncher(
            com.xccdos.prolog.evolution.application.EvolutionClusteringScheduler scheduler
    ) {
        return new EvolutionScheduledLauncher(scheduler);
    }

    public static class EvolutionScheduledLauncher {

        private final com.xccdos.prolog.evolution.application.EvolutionClusteringScheduler scheduler;

        public EvolutionScheduledLauncher(com.xccdos.prolog.evolution.application.EvolutionClusteringScheduler scheduler) {
            this.scheduler = scheduler;
        }

        public void runScheduledClustering() {
            scheduler.runScheduledClustering();
        }
    }
}
