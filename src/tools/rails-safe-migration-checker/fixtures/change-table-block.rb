class ExtendUsers < ActiveRecord::Migration[7.1]
  def change
    change_table :users do |t|
      t.column :nickname, :string
      t.references :team, index: true
    end
  end
end
