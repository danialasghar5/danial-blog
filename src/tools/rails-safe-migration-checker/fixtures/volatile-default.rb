class AddPublicIdToOrders < ActiveRecord::Migration[7.1]
  def change
    add_column :orders, :public_id, :uuid, default: -> { "gen_random_uuid()" }
  end
end
