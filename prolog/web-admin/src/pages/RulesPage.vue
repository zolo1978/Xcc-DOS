<script setup lang="ts">
import RuleDialog from "@/components/RuleDialog.vue";
import { api } from "@/lib/api";
import { RULE_STATUS_META, RULE_TYPE_META, type Rule, type RuleDraft, type RuleStatus, type RuleType } from "@/lib/types";
import { onMounted, reactive, ref } from "vue";

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const grayDialogVisible = ref(false);
const rollbackDialogVisible = ref(false);
const rules = ref<Rule[]>([]);
const currentRule = ref<Rule | null>(null);
const grayForm = reactive({ grayRate: 10 });
const rollbackForm = reactive({ version: 1 });

async function loadRules() {
  loading.value = true;
  try {
    const response = await api.listRules();
    rules.value = response.items;
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  currentRule.value = null;
  dialogVisible.value = true;
}

function openEditDialog(rule: Rule) {
  currentRule.value = rule;
  dialogVisible.value = true;
}

function openGrayDialog(rule: Rule) {
  currentRule.value = rule;
  grayForm.grayRate = rule.grayRate;
  grayDialogVisible.value = true;
}

function openRollbackDialog(rule: Rule) {
  currentRule.value = rule;
  rollbackForm.version = Math.max(1, rule.version - 1);
  rollbackDialogVisible.value = true;
}

function rollbackOptions(rule: Rule) {
  return Array.from({ length: Math.max(rule.version - 1, 0) }, (_, index) => rule.version - index - 1);
}

async function submitRule(payload: RuleDraft) {
  saving.value = true;
  try {
    if (currentRule.value) {
      await api.updateRule(currentRule.value.id, payload);
    } else {
      await api.createRule(payload);
    }
    dialogVisible.value = false;
    await loadRules();
  } finally {
    saving.value = false;
  }
}

async function publishGray() {
  if (!currentRule.value) {
    return;
  }
  saving.value = true;
  try {
    await api.publishGray(currentRule.value.id, grayForm.grayRate);
    grayDialogVisible.value = false;
    await loadRules();
  } finally {
    saving.value = false;
  }
}

async function rollbackVersion() {
  if (!currentRule.value) {
    return;
  }
  saving.value = true;
  try {
    await api.rollbackRule(currentRule.value.id, rollbackForm.version);
    rollbackDialogVisible.value = false;
    await loadRules();
  } finally {
    saving.value = false;
  }
}

onMounted(loadRules);
</script>

<template>
  <div class="page-header">
    <div>
      <h1 class="page-title">规则管理</h1>
      <p class="page-subtitle">覆盖列表、编辑、灰度发布与版本回滚。</p>
    </div>
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">新建规则</el-button>
      <el-button plain :loading="loading" @click="loadRules">刷新</el-button>
    </div>
  </div>

  <el-table v-loading="loading" :data="rules" border>
    <el-table-column prop="ruleCode" label="编码" min-width="140" />
    <el-table-column prop="ruleName" label="规则名称" min-width="180" />
    <el-table-column label="类型" width="120">
      <template #default="{ row }">
        <el-tag :type="RULE_TYPE_META[row.ruleType as RuleType].type">{{ RULE_TYPE_META[row.ruleType as RuleType].label }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="120">
      <template #default="{ row }">
        <el-tag :type="RULE_STATUS_META[row.status as RuleStatus].type">{{ RULE_STATUS_META[row.status as RuleStatus].label }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="version" label="版本" width="90" />
    <el-table-column prop="grayRate" label="灰度比例" width="110">
      <template #default="{ row }">{{ row.grayRate }}%</template>
    </el-table-column>
    <el-table-column prop="ruleContent" label="规则内容" min-width="280" show-overflow-tooltip />
    <el-table-column label="操作" width="320" fixed="right">
      <template #default="{ row }">
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button link type="warning" @click="openGrayDialog(row)">灰度发布</el-button>
          <el-button link type="danger" :disabled="row.version <= 1" @click="openRollbackDialog(row)">
            版本回滚
          </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>

  <RuleDialog
    v-model="dialogVisible"
    :current-rule="currentRule"
    :saving="saving"
    @submit="submitRule"
  />

  <el-dialog v-model="grayDialogVisible" title="灰度发布" width="420px">
    <el-form label-width="96px">
      <el-form-item label="灰度比例">
        <el-input-number v-model="grayForm.grayRate" :min="0" :max="100" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="grayDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="publishGray">确认发布</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="rollbackDialogVisible" title="版本回滚" width="420px">
    <el-form label-width="96px">
      <el-form-item label="目标版本">
        <el-select v-model="rollbackForm.version" class="full-width">
          <el-option
            v-for="version in currentRule ? rollbackOptions(currentRule) : []"
            :key="version"
            :label="`版本 ${version}`"
            :value="version"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="rollbackDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="rollbackVersion">确认回滚</el-button>
    </template>
  </el-dialog>
</template>
