function buildTagIndex(posts) {
  const tagMap = new Map();

  for (const post of posts) {
    for (const tagValue of post.tags) {
      const tag = typeof tagValue === 'string' ? tagValue : tagValue.name;
      if (!tag) {
        continue;
      }
      if (!tagMap.has(tag)) {
        tagMap.set(tag, []);
      }
      tagMap.get(tag).push(post);
    }
  }

  return Array.from(tagMap.entries())
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([tag, tagPosts]) => ({
      tag,
      posts: [...tagPosts],
    }));
}

module.exports = { buildTagIndex };
