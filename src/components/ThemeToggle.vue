<template>
  <button
    class="theme-toggle"
    :class="{ 'is-dark': isDark }"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="$emit('toggle')"
  >
    <span class="toggle-track">
      <span class="toggle-icon toggle-icon--sun" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      </span>
      <span class="toggle-icon toggle-icon--moon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </span>
    </span>
  </button>
</template>

<script setup>
defineProps({ isDark: Boolean })
defineEmits(['toggle'])
</script>

<style scoped>
.theme-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-2);
  border-radius: 10px;
  background: var(--surface-2);
  cursor: pointer;
  flex-shrink: 0;
  transition: background .2s, border-color .2s, box-shadow .2s;
  overflow: hidden;
}
.theme-toggle:hover {
  background: var(--accent-bg);
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}
.theme-toggle:active { transform: scale(.92); }

.toggle-track {
  position: relative;
  width: 18px;
  height: 18px;
}

.toggle-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity .3s ease, transform .35s ease;
}

/* Light mode: show sun, hide moon */
.theme-toggle:not(.is-dark) .toggle-icon--sun {
  opacity: 1;
  transform: rotate(0deg) scale(1);
  color: var(--yellow);
}
.theme-toggle:not(.is-dark) .toggle-icon--moon {
  opacity: 0;
  transform: rotate(-45deg) scale(.6);
  color: var(--accent);
}

/* Dark mode: show moon, hide sun */
.theme-toggle.is-dark .toggle-icon--sun {
  opacity: 0;
  transform: rotate(45deg) scale(.6);
  color: var(--yellow);
}
.theme-toggle.is-dark .toggle-icon--moon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
  color: var(--accent-bright);
}
</style>
