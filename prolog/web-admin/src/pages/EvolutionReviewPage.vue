<script setup lang="ts">
import { api } from "@/lib/api";
import { REVIEW_STATUS_META, type GeneratedRule, type ReviewStatus } from "@/lib/types";
import { onMounted, reactive, ref } from "vue";

const loading = ref(false);
const reviewItems = ref<GeneratedRule[]>([]);
const rejectDialogVisible = ref(false);
const currentRuleId = ref("");
const rejectForm = reactive({ reason: "" });

async function loadReviewItems() {
  loading.value = true;
  try {
    const response = await api.listGeneratedRules("pending_review");
    reviewItems.value = response.items;
  } finally {
    loading.value = false;
  }
}

async function approve(id: string) {
  await api.approveGeneratedRule(id);
  reviewItems.value = reviewItems.value.filter((item) => item.id !== id);
}

function openRejectDialog(id: string) {
  currentRuleId.value = id;
  rejectForm.reason = "";
  rejectDialogVisible.value = true;
}

async function reject() {
  await api.rejectGeneratedRule(currentRuleId.value, rejectForm.reason);
  reviewItems.value = reviewItems.value.filter((item) => item.id !== currentRuleId.value);
  rejectDialogVisible.value = false;
}

onMounted(loadReviewItems);
</script>

<template>
  <div class="page-header">
    <div>
      <h1 class="page-title">自进化审核</h1>
      <p class="page-subtitle">待审核候选规则来自聚类与生成链路，审核结果直接写回规则体系。</p>
    </div>
    <el-button plain :loading="loading" @click="loadReviewItems">刷新</el-button>
  </div>

  <el-table v-loading="loading" :data="reviewItems" border>
    <el-table-column prop="sourceClusterId" label="聚类任务" width="120" />
    <el-table-column prop="ruleContent" label="候选规则" min-width="380" show-overflow-tooltip />
    <el-table-column prop="confidence" label="置信度" width="120" />
    <el-table-column label="状态" width="120">
      <template #default="{ row }">
        <el-tag :type="REVIEW_STATUS_META[row.reviewStatus as ReviewStatus].type">{{ REVIEW_STATUS_META[row.reviewStatus as ReviewStatus].label }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="180">
      <template #default="{ row }">
        <div style="display: flex; gap: 8px">
          <el-button type="success" link @click="approve(row.id)">通过</el-button>
          <el-button type="danger" link @click="openRejectDialog(row.id)">拒绝</el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>

  <el-dialog v-model="rejectDialogVisible" title="拒绝原因" width="520px">
    <el-form>
      <el-form-item label="原因">
        <el-input v-model="rejectForm.reason" type="textarea" :rows="5" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="rejectDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="reject">确认拒绝</el-button>
    </template>
  </el-dialog>
</template>
