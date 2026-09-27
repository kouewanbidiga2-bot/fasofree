import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * 🤝 Preuve d'acceptation d'un document légal (protocole README §5).
 *
 * Une ligne = un compte + un document + une version : l'index unique bloque
 * le double enregistrement de la même version ; une version plus récente du
 * document génère une nouvelle ligne (on peut prouver QUELLE version a été
 * acceptée et QUAND).
 *
 * `mechanism` : case-a-cocher (client web/mobile) ou signature-otp (contrat
 * marchand/livreur signé via code OTP).
 * `source` / `ip` : contextualisation de l'acceptation (web, mobile, dashboard).
 *
 * ⚠️ Les NOMS de contrainte/index sont explicités pour correspondre EXACTEMENT
 * à la migration 1729100000000 (le schéma dev — synchronize — et prod —
 * migrations — produisent alors le même DDL). La FK vers users(id) est
 * déclarée en relation pour exister aussi en dev (sinon lignes orphelines à
 * la suppression d'un compte hors prod).
 */
@Entity('contract_acceptances')
@Unique('UQ_contract_acceptances_user_doc_version', ['userId', 'docCode', 'docVersion'])
@Index('IDX_contract_acceptances_userId', ['userId'])
export class ContractAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  docCode: string;

  @Column({ type: 'varchar', length: 20 })
  docVersion: string;

  @Column({ type: 'varchar', length: 30, default: 'case-a-cocher' })
  mechanism: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @CreateDateColumn()
  acceptedAt: Date;
}