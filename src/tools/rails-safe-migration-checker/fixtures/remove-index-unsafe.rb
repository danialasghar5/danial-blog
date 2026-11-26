class DropOldIndex < ActiveRecord::Migration[7.1]
  def change
    remove_index :orders, :legacy_code
  end
end
