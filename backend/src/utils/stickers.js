export const stickerPacks = [
  { id: 'convo-moods', name: 'Little moods', cover: '/stickers/spark.svg', stickers: ['spark', 'sunny', 'love', 'wow', 'cozy', 'cheers'] },
  { id: 'convo-nature', name: 'Soft nature', cover: '/stickers/leaf.svg', stickers: ['leaf', 'bloom', 'cloud', 'moon', 'rainbow', 'mushroom'] },
]

export const stickers = Object.fromEntries(stickerPacks.flatMap(pack => pack.stickers.map(id => [id, { id, packId: pack.id, url: `/stickers/${id}.svg` }])))
