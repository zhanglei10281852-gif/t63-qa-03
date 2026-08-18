import { createRouter, createWebHistory } from "vue-router";
import AppShell from "./components/AppShell.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: () => import("./views/LoginView.vue"), meta: { public: true, title: "登录" } },
    {
      path: "/",
      component: AppShell,
      redirect: "/fleet",
      children: [
        { path: "fleet", component: () => import("./views/FleetView.vue"), meta: { title: "车辆与驾驶员" } },
        { path: "planning", component: () => import("./views/PlanningView.vue"), meta: { title: "路线与排班" } },
        { path: "operations", component: () => import("./views/OperationsView.vue"), meta: { title: "运营执行" } },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/fleet" },
  ],
});

router.beforeEach(to => {
  const authenticated = Boolean(localStorage.getItem("sanitation_session"));
  if (!to.meta.public && !authenticated) return "/login";
  if (to.path === "/login" && authenticated) return "/fleet";
  return true;
});

export default router;
