import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("用户名").fill("admin");
  await page.getByLabel("密码").fill("local-admin-only");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/fleet$/);
}

test("operator can navigate the three desktop workspaces", async ({ page }) => {
  const browserErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await login(page);
  const headerStyles = await page.locator(".app-header").evaluate(element => {
    const header = getComputedStyle(element);
    const title = getComputedStyle(element.querySelector(".header-title")!);
    return { background: header.backgroundColor, lineHeight: header.lineHeight, titleColor: title.color };
  });
  expect(headerStyles).toEqual({ background: "rgb(255, 255, 255)", lineHeight: "normal", titleColor: "rgb(23, 33, 43)" });
  await expect(page.getByText("服务正常")).toBeVisible();
  await expect(page.getByText("车辆总数")).toBeVisible();
  await expect(page.locator(".ant-table-tbody .ant-table-row").first()).toBeVisible();
  await page.getByRole("tab", { name: "驾驶员与资格" }).click();
  await expect(page.getByText("示范驾驶员")).toBeVisible();

  await page.getByText("路线与排班", { exact: true }).click();
  await expect(page).toHaveURL(/\/planning$/);
  await expect(page.getByText("路线与班次")).toBeVisible();
  await expect(page.locator(".ant-tabs-tabpane-active")).not.toContainText(/vehicle_[a-f0-9]+/);
  await page.getByRole("tab", { name: "路线目录" }).click();
  await expect(page.locator(".ant-tabs-tabpane-active").getByRole("cell", { name: "静安北片区清运线" })).toBeVisible();
  await page.getByRole("button", { name: /新增路线/ }).click();
  await expect(page.getByRole("dialog").getByText("新增服务路线")).toBeVisible();
  await page.getByRole("dialog").locator(".ant-modal-footer .ant-btn-default").click();

  await page.getByText("运营执行", { exact: true }).click();
  await expect(page).toHaveURL(/\/operations$/);
  await expect(page.getByText("运营执行工作台")).toBeVisible();
  await expect(page.getByRole("tab", { name: "安全检查" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "维修与能源" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "日结核对" })).toBeVisible();
  await page.getByRole("button", { name: /办理出车/ }).click();
  await expect(page.getByRole("dialog").getByText("办理出车")).toBeVisible();
  await expect(page.getByText("幂等业务号")).toBeVisible();
  await page.getByRole("dialog").locator(".ant-modal-footer .ant-btn-default").click();
  await expect(page.locator(".ant-tabs-tabpane-active")).not.toContainText(/vehicle_[a-f0-9]+/);

  await page.getByRole("tab", { name: "安全检查" }).click();
  await expect(page.locator(".ant-tabs-tabpane-active")).not.toContainText(/vehicle_[a-f0-9]+/);

  await page.getByRole("tab", { name: "维修与能源" }).click();
  await expect(page.getByText("维修工单", { exact: true })).toBeVisible();
  await expect(page.getByText("能源记录", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /新建维修单/ })).toBeVisible();
  const maintenancePane = page.locator(".ant-tabs-tabpane-active");
  await expect(maintenancePane).not.toContainText(/vehicle_[a-f0-9]+/);

  await page.getByRole("button", { name: /记录加油\/充电/ }).click();
  const fuelDialog = page.getByRole("dialog", { name: "记录能源补给" });
  await fuelDialog.locator(".ant-form-item").first().locator(".ant-select-selector").click();
  await page.locator(".ant-select-item-option").filter({ hasText: "沪A00001" }).click();
  const odometerInput = fuelDialog.locator(".ant-form-item").filter({ hasText: "里程" }).getByRole("spinbutton");
  await expect(odometerInput).toHaveValue("12000");
  await fuelDialog.getByRole("button", { name: "确 定" }).click();
  await expect(page.getByText("能源记录已保存")).toBeVisible();
  await expect(fuelDialog).not.toBeVisible();
  await expect(maintenancePane).toContainText("沪A00001");

  await page.getByRole("tab", { name: "日结核对" }).click();
  await expect(page.getByText(/业务日(核对通过|存在待处理项)/)).toBeVisible();
  await expect(page.getByText("计划班次", { exact: true })).toBeVisible();

  expect(failedResponses).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("fleet filters and Ant Design controls remain usable", async ({ page }) => {
  const failedResponses: string[] = [];
  page.on("response", response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await login(page);
  await expect(page.locator(".ant-table-tbody .ant-table-row").first()).toBeVisible();
  await page.getByPlaceholder("车牌、车型或车场").fill("002");
  await page.getByPlaceholder("车牌、车型或车场").press("Enter");
  await expect(page.locator(".ant-table-tbody")).toContainText("002");
  await page.locator(".toolbar .ant-select").first().click();
  await page.locator(".ant-select-item-option").filter({ hasText: "可用" }).last().click();
  await expect(page.locator(".ant-table-tbody")).toContainText("002");
  await page.getByRole("button", { name: /新增车辆/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("新增车辆")).toBeVisible();
  await dialog.getByLabel("车牌号").fill("123123");
  await dialog.locator(".ant-modal-footer .ant-btn-primary").click();
  await expect(dialog.getByText("请输入有效车牌号")).toBeVisible();
  await dialog.locator(".ant-modal-footer .ant-btn-default").click();
  expect(failedResponses).toEqual([]);
});
