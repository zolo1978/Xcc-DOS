import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import { createApp } from "vue";
import App from "./App.vue";
import { createAppRouter } from "./router";
import "./styles.css";

const app = createApp(App);
const pinia = createPinia();
const router = createAppRouter(pinia);

app.use(pinia);
app.use(router);
app.use(ElementPlus);
app.mount("#app");
