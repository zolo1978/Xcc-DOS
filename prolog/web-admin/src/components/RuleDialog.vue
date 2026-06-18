<script setup lang="ts">
import type { Rule, RuleDraft } from "@/lib/types";
import { reactive, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  currentRule: Rule | null;
  saving: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  submit: [payload: RuleDraft];
}>();

const form = reactive<RuleDraft>({
  ruleCode: "",
  ruleName: "",
  ruleContent: "",
  ruleType: "process",
  parentRuleId: "",
  grayRate: 0
});

watch(
  () => props.currentRule,
  (currentRule) => {
    form.ruleCode = currentRule?.ruleCode ?? "";
    form.ruleName = currentRule?.ruleName ?? "";
    form.ruleContent = currentRule?.ruleContent ?? "";
    form.ruleType = currentRule?.ruleType ?? "process";
    form.parentRuleId = currentRule?.parentRuleId ?? "";
    form.grayRate = currentRule?.grayRate ?? 0;
  },
  { immediate: true }
);

function closeDialog() {
  emit("update:modelValue", false);
}

function submitForm() {
  emit("submit", {
    ruleCode: form.ruleCode,
    ruleName: form.ruleName,
    ruleContent: form.ruleContent,
    ruleType: form.ruleType,
    parentRuleId: form.parentRuleId,
    grayRate: form.grayRate
  });
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="currentRule ? '编辑规则' : '新建规则'"
    width="720px"
    @close="closeDialog"
  >
    <el-form label-width="96px">
      <el-form-item label="规则编码">
        <el-input v-model="form.ruleCode" />
      </el-form-item>
      <el-form-item label="规则名称">
        <el-input v-model="form.ruleName" />
      </el-form-item>
      <el-form-item label="规则类型">
        <el-select v-model="form.ruleType" class="full-width">
          <el-option label="流程规则" value="process" />
          <el-option label="校验规则" value="validation" />
          <el-option label="路由规则" value="routing" />
        </el-select>
      </el-form-item>
      <el-form-item label="父规则 ID">
        <el-input v-model="form.parentRuleId" placeholder="可为空" />
      </el-form-item>
      <el-form-item label="灰度比例">
        <el-input-number v-model="form.grayRate" :min="0" :max="100" />
      </el-form-item>
      <el-form-item label="规则内容">
        <el-input v-model="form.ruleContent" type="textarea" :rows="8" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>
</template>
