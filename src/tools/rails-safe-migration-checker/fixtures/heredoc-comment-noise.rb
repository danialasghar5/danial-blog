# add_index :orders, :customer_id
class ReindexNoise < ActiveRecord::Migration[7.1]
  def up
    # remove_column :orders, :legacy
    say "add_column :orders, :x, :string"
=begin
add_index :orders, :ignored_here
=end
    execute <<~SQL
      -- add_index :orders, :customer_id
      CREATE INDEX CONCURRENTLY orders_noise_idx ON orders (customer_id);
    SQL
  end
end
