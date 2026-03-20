const { generateSite, watchSite } = require('./src/generator');

async function main() {
  const watchMode = process.argv.includes('--watch');

  if (watchMode) {
    await generateSite();
    watchSite();
    return;
  }

  await generateSite();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
