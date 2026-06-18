<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">会话总览</h1>
        <p class="page-subtitle">后端当前缺少会话列表端点，本页先保留只读占位，等待接口补齐后可直接接入。</p>
      </div>
    </div>

    <el-alert
      title="仅占位"
      description="现有 Spring Boot 控制器只提供按 sessionId 查询，不提供 GET /api/v1/sessions 列表。"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 20px"
    />

    <el-table :data="[]" border>
      <el-table-column prop="sessionId" label="Session ID" min-width="220" />
      <el-table-column prop="userIp" label="用户 IP" min-width="140" />
      <el-table-column prop="currentState" label="当前状态" min-width="160" />
      <el-table-column prop="lastActiveTime" label="最近活跃" min-width="180" />
      <el-table-column prop="sessionStatus" label="会话状态" min-width="120" />
    </el-table>
  </div>
</template>
