<script setup lang="ts">
import { api } from "@/lib/api";
import { SYNONYM_STATUS_META, type Synonym, type SynonymDraft, type SynonymStatus } from "@/lib/types";
import { onMounted, reactive, ref } from "vue";

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const currentSynonym = ref<Synonym | null>(null);
const synonyms = ref<Synonym[]>([]);

const form = reactive<SynonymDraft>({
  originWord: "",
  synonymWord: "",
  priority: 100,
  status: "active"
});

async function loadSynonyms() {
  loading.value = true;
  try {
    const response = await api.listSynonyms();
    synonyms.value = response.items;
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  currentSynonym.value = null;
  form.originWord = "";
  form.synonymWord = "";
  form.priority = 100;
  form.status = "active";
  dialogVisible.value = true;
}

function openEditDialog(item: Synonym) {
  currentSynonym.value = item;
  form.originWord = item.originWord;
  form.synonymWord = item.synonymWord;
  form.priority = item.priority;
  form.status = item.status;
  dialogVisible.value = true;
}

async function saveSynonym() {
  saving.value = true;
  try {
    if (currentSynonym.value) {
      await api.updateSynonym(currentSynonym.value.id, form);
    } else {
      await api.createSynonym(form);
    }
    dialogVisible.value = false;
    await loadSynonyms();
  } finally {
    saving.value = false;
  }
}

async function removeSynonym(item: Synonym) {
  await api.deleteSynonym(item.id);
  await loadSynonyms();
}

onMounted(loadSynonyms);
</script>

<template>
  <div class="page-header">
    <div>
      <h1 class="page-title">同义词管理</h1>
      <p class="page-subtitle">支持词条 CRUD 与优先级调整，便于规则匹配前置归一。</p>
    </div>
    <div class="toolbar">
      <el-button type="primary" @click="openCreateDialog">新增词条</el-button>
      <el-button plain :loading="loading" @click="loadSynonyms">刷新</el-button>
    </div>
  </div>

  <el-table v-loading="loading" :data="synonyms" border>
    <el-table-column prop="originWord" label="原词" min-width="160" />
    <el-table-column prop="synonymWord" label="同义词" min-width="180" />
    <el-table-column prop="priority" label="优先级" width="100" />
    <el-table-column label="状态" width="120">
      <template #default="{ row }">
        <el-tag :type="SYNONYM_STATUS_META[row.status as SynonymStatus].type">{{ SYNONYM_STATUS_META[row.status as SynonymStatus].label }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="180">
      <template #default="{ row }">
        <div style="display: flex; gap: 8px">
          <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="removeSynonym(row)">删除</el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>

  <el-dialog v-model="dialogVisible" :title="currentSynonym ? '编辑同义词' : '新增同义词'" width="520px">
    <el-form label-width="96px">
      <el-form-item label="原词">
        <el-input v-model="form.originWord" />
      </el-form-item>
      <el-form-item label="同义词">
        <el-input v-model="form.synonymWord" />
      </el-form-item>
      <el-form-item label="优先级">
        <el-input-number v-model="form.priority" :min="0" :max="9999" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status" class="full-width">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveSynonym">保存</el-button>
    </template>
  </el-dialog>
</template>
