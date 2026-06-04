import { createSSRApp } from "vue";
import App from "./App.vue";
import { setupI18n } from "./utils/i18n";

export function createApp() {
	const app = createSSRApp(App);
	setupI18n(app);
	return {
		app,
	};
}
