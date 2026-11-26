class DropLegacyToken < ActiveRecord::Migration[7.1]
  def change
    remove_column :orders, :legacy_token
  end
end
