<script>
import { translateTabBar } from './utils/i18n';

export default {
  onLaunch: function () {
    console.log('App Launch');
  },
  onShow: function () {
    console.log('App Show');
    // 在 onShow 時套用 TabBar 翻譯，確保頁面切換與重新啟動時生效
    setTimeout(() => {
      translateTabBar();
    }, 100);
  },
  onHide: function () {
    console.log('App Hide');
  },
}
</script>

<style>
/*每个页面公共css */
</style>
