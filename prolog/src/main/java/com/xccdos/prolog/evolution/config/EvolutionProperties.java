package com.xccdos.prolog.evolution.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "prolog.evolution")
public class EvolutionProperties {

    private String clusteringFlowId = "request-log-clustering";
    private String ruleGenerationFlowId = "rule-generation";
    private int sampleLimit = 100;
    private final Clustering clustering = new Clustering();

    public String getClusteringFlowId() {
        return clusteringFlowId;
    }

    public void setClusteringFlowId(String clusteringFlowId) {
        this.clusteringFlowId = clusteringFlowId;
    }

    public String getRuleGenerationFlowId() {
        return ruleGenerationFlowId;
    }

    public void setRuleGenerationFlowId(String ruleGenerationFlowId) {
        this.ruleGenerationFlowId = ruleGenerationFlowId;
    }

    public int getSampleLimit() {
        return sampleLimit;
    }

    public void setSampleLimit(int sampleLimit) {
        this.sampleLimit = sampleLimit;
    }

    public Clustering getClustering() {
        return clustering;
    }

    public static class Clustering {

        private boolean enabled;
        private String cron = "0 0 3 * * ?";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getCron() {
            return cron;
        }

        public void setCron(String cron) {
            this.cron = cron;
        }
    }
}
