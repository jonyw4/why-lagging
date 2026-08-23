import { createRouter, createWebHistory } from "vue-router";
import DiagnosePage from "./pages/DiagnosePage.vue";
import HomePage from "./pages/HomePage.vue";
import LivePage from "./pages/LivePage.vue";

export const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: "/", name: "home", component: HomePage },
		{ path: "/diagnose", name: "diagnose", component: DiagnosePage },
		{ path: "/live", name: "live", component: LivePage },
	],
	scrollBehavior() {
		return { top: 0 };
	},
});
