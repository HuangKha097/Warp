import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
  page.on('pageerror',error=>console.error('Renderer error:',error.message));
  page.on('console',message=>{if(message.type()==='error')console.error('Browser console:',message.text());});
  page.on('requestfailed',request=>console.error('Request failed:',request.url(),request.failure()?.errorText));
});
test('dragging the hollow center commits the enabled PDF slice once',async({page})=>{
  await page.goto('/tests/ui/fixture.html?mode=overlay');
  const origin=page.getByRole('button',{name:'Kéo tài liệu.txt sang định dạng'});
  await expect(origin).toBeEnabled();
  await page.mouse.move(500,400);await page.mouse.down();await page.mouse.move(500,253,{steps:12});await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>JSON.stringify((window as any).__warpTest.calls))).toBe('[{"name":"convert","value":"pdf"}]');
  await page.screenshot({path:'.cache/ui-orbit.png',omitBackground:true});
});
test('settings preserve the source-folder default, update language and choose a destination',async({page})=>{
  await page.goto('/tests/ui/fixture.html?mode=settings');
  await expect(page.getByRole('radio',{name:'Ở thư mục cùng file gốc'})).toBeChecked();
  await page.getByLabel('Ngôn ngữ',{exact:true}).selectOption('en');
  await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:'In a chosen folder'}).check();
  await expect(page.getByText('C:\\Converted',{exact:true})).toBeVisible();
  await page.getByRole('switch').uncheck();
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.screenshot({path:'.cache/ui-settings.png'});
});
test('onboarding uses reduced-motion posters and completes all three steps',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/tests/ui/fixture.html?mode=onboarding');
  await expect(page.locator('.onboarding-visual img')).toHaveAttribute('src',/\.png$/);
  await page.getByRole('button',{name:'Tiếp tục'}).click();
  await expect(page.getByRole('heading',{name:'Giữ phím. Kéo. Chuyển đổi.'})).toBeVisible();
  await page.getByRole('button',{name:'Tiếp tục'}).click();
  await expect(page.getByRole('heading',{name:'Bản sao mới. Bản gốc vẫn nguyên.'})).toBeVisible();
  await page.getByRole('button',{name:'Bắt đầu dùng Warp'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__warpTest.calls.at(-1)?.name)).toBe('finish');
});
test('progress renders running, error/retry and success/reveal states',async({page})=>{
  await page.goto('/tests/ui/fixture.html?mode=status');
  await expect(page.getByText('Đang chuyển đổi…',{exact:true})).toBeVisible();
  await expect(page.locator('.progress-card')).toContainText('tài liệu.txt');
  await page.evaluate(()=>{const t=(window as any).__warpTest;t.update({job:{...t.state.job,status:'error',error:'File bị hỏng.',failures:[{name:t.state.file,error:'File bị hỏng.'}]}});});
  await page.getByRole('button',{name:'Thử lại'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__warpTest.calls.at(-1)?.name)).toBe('retry');
  await page.evaluate(()=>{const t=(window as any).__warpTest;t.update({job:{...t.state.job,status:'success',output:'C:\\Documents\\tài liệu.pdf',error:undefined,failures:[]}});});
  await page.getByRole('button',{name:'Mở thư mục'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__warpTest.calls.at(-1)?.name)).toBe('reveal');
  await page.screenshot({path:'.cache/ui-progress.png',omitBackground:true});
});
