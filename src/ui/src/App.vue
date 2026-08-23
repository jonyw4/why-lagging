<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
	<div class="app-shell">
		<header class="app-header">
			<RouterLink to="/" class="brand">
				<span class="brand-mark" aria-hidden="true" />
				Internet Diag
			</RouterLink>
		</header>
		<RouterView />
	</div>
</template>
