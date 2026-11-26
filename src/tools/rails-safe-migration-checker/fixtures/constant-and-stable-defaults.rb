class AddFieldsToOrders < ActiveRecord::Migration[7.1]
  def change
    add_column :orders, :priority, :integer, default: 0, null: false
    add_column :orders, :archived, :boolean, default: false
    add_column :orders, :imported_at, :datetime, default: -> { "CURRENT_TIMESTAMP" }
  end
end
