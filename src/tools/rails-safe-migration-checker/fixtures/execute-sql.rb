class BackfillPostSlugs < ActiveRecord::Migration[7.1]
  def up
    execute "UPDATE posts SET slug = lower(title)"
    execute "CREATE INDEX posts_slug_idx ON posts (slug)"
  end

  def down
    execute "DROP INDEX posts_slug_idx"
  end
end
